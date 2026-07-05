"""
Greeks Math Engine (pure module -- no side effects at import).

Provides:
  - bs_price, bs_greeks       : single-option pricing and Greeks
  - Greeks, Leg, Position     : data containers
  - simulate, SimulationResult: scenario simulator with P&L decomposition

Leg model notes:
  - kind "stock": delta=1/share, all other Greeks zero. strike/expiry/sigma
    are ignored. quantity is in units of 100 shares (qty 1 = 100 shares) so
    it composes with the option contract multiplier.
  - leg.sigma: per-leg IV override (decimal). Falls back to position.sigma.
    This is how skew enters the model — wings priced at their own vol.
  - leg.entry_price: the user's actual fill per share. Only affects cost
    basis (net debit/credit, payoff P&L baseline) — mark-to-model pricing
    and the scenario decomposition are unaffected.
  - IV shocks are PARALLEL SHIFTS: every option leg's own IV moves by
    dSigma, preserving skew shape.
"""
import math
from dataclasses import dataclass
from typing import Literal, Optional

from scipy.stats import norm


LegKind = Literal["call", "put", "stock"]
OptionType = Literal["call", "put"]
CONTRACT_MULTIPLIER = 100  # standard US equity option = 100 shares

# Floor for shocked IVs so a large negative dSigma can't push vol to <= 0.
MIN_SIGMA = 0.001


def bs_price(S: float, K: float, T: float, r: float, sigma: float, kind: OptionType) -> float:
    """Black-Scholes price PER SHARE for a European option."""
    if T <= 0:
        return max(S - K, 0.0) if kind == "call" else max(K - S, 0.0)

    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if kind == "call":
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
    return K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)


@dataclass
class Greeks:
    price: float
    delta: float
    gamma: float
    theta_per_day: float
    vega_per_volpoint: float
    rho_per_pct: float


def bs_greeks(S: float, K: float, T: float, r: float, sigma: float, kind: OptionType) -> Greeks:
    """All Greeks for a SINGLE option, PER SHARE."""
    price = bs_price(S, K, T, r, sigma, kind)

    if T <= 0:
        delta = (1.0 if (kind == "call" and S > K) else
                 -1.0 if (kind == "put" and S < K) else 0.0)
        return Greeks(price, delta, 0.0, 0.0, 0.0, 0.0)

    sqrt_T = math.sqrt(T)
    d1 = (math.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt_T)
    d2 = d1 - sigma * sqrt_T
    pdf_d1 = norm.pdf(d1)
    disc = math.exp(-r * T)

    delta = norm.cdf(d1) if kind == "call" else norm.cdf(d1) - 1.0
    gamma = pdf_d1 / (S * sigma * sqrt_T)

    term1 = -(S * pdf_d1 * sigma) / (2.0 * sqrt_T)
    if kind == "call":
        term2 = -r * K * disc * norm.cdf(d2)
    else:
        term2 = r * K * disc * norm.cdf(-d2)
    theta_per_day = (term1 + term2) / 365.0
    vega_per_volpoint = (S * pdf_d1 * sqrt_T) / 100.0
    if kind == "call":
        rho_per_pct = (K * T * disc * norm.cdf(d2)) / 100.0
    else:
        rho_per_pct = (-K * T * disc * norm.cdf(-d2)) / 100.0

    return Greeks(price, delta, gamma, theta_per_day, vega_per_volpoint, rho_per_pct)


@dataclass
class Leg:
    kind: LegKind
    strike: float
    expiry_days: int
    quantity: int
    sigma: Optional[float] = None        # per-leg IV override (decimal)
    entry_price: Optional[float] = None  # actual fill per share


@dataclass
class Position:
    legs: list[Leg]
    S: float
    sigma: float
    r: float

    # --- per-leg helpers -------------------------------------------------

    def _leg_sigma(self, leg: Leg, dSigma: float = 0.0) -> float:
        """Effective IV for a leg: its own override or the position IV,
        parallel-shifted by dSigma, floored so shocked vol stays positive."""
        base = leg.sigma if leg.sigma is not None else self.sigma
        return max(MIN_SIGMA, base + dSigma)

    def leg_model_price(self, leg: Leg) -> float:
        """Model price PER SHARE at position-open state (no shocks)."""
        if leg.kind == "stock":
            return self.S
        return bs_price(
            self.S, leg.strike, leg.expiry_days / 365.0,
            self.r, self._leg_sigma(leg), leg.kind,
        )

    def cost_basis(self) -> float:
        """Total dollars paid (positive = debit) using the user's entry
        prices where given, model prices otherwise."""
        total = 0.0
        for leg in self.legs:
            per_share = (leg.entry_price if leg.entry_price is not None
                         else self.leg_model_price(leg))
            total += leg.quantity * per_share * CONTRACT_MULTIPLIER
        return total

    # --- aggregate valuation ---------------------------------------------

    def price(self, S: Optional[float] = None, dSigma: float = 0.0,
              days_elapsed: int = 0) -> float:
        """Mark-to-model value of the whole position under an optional shock."""
        S_use = S if S is not None else self.S
        total = 0.0
        for leg in self.legs:
            if leg.kind == "stock":
                total += leg.quantity * S_use * CONTRACT_MULTIPLIER
                continue
            T_rem = max(0.0, (leg.expiry_days - days_elapsed) / 365.0)
            per_share = bs_price(
                S_use, leg.strike, T_rem, self.r,
                self._leg_sigma(leg, dSigma), leg.kind,
            )
            total += leg.quantity * per_share * CONTRACT_MULTIPLIER
        return total

    def greeks(self, S: Optional[float] = None, dSigma: float = 0.0,
               days_elapsed: int = 0) -> Greeks:
        """Aggregate Greeks under an optional shock. Stock legs contribute
        delta only (1 per share)."""
        S_use = S if S is not None else self.S
        agg = Greeks(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        for leg in self.legs:
            q = leg.quantity * CONTRACT_MULTIPLIER
            if leg.kind == "stock":
                agg = Greeks(
                    price=agg.price + S_use * q,
                    delta=agg.delta + 1.0 * q,
                    gamma=agg.gamma,
                    theta_per_day=agg.theta_per_day,
                    vega_per_volpoint=agg.vega_per_volpoint,
                    rho_per_pct=agg.rho_per_pct,
                )
                continue
            T_rem = max(0.0, (leg.expiry_days - days_elapsed) / 365.0)
            g = bs_greeks(
                S_use, leg.strike, T_rem, self.r,
                self._leg_sigma(leg, dSigma), leg.kind,
            )
            agg = Greeks(
                price=agg.price + g.price * q,
                delta=agg.delta + g.delta * q,
                gamma=agg.gamma + g.gamma * q,
                theta_per_day=agg.theta_per_day + g.theta_per_day * q,
                vega_per_volpoint=agg.vega_per_volpoint + g.vega_per_volpoint * q,
                rho_per_pct=agg.rho_per_pct + g.rho_per_pct * q,
            )
        return agg


@dataclass
class SimulationResult:
    actual_pnl: float
    delta_contribution: float
    gamma_contribution: float
    theta_contribution: float
    vega_contribution: float
    sum_of_components: float
    residual: float
    initial_greeks: Greeks
    new_greeks: Greeks


def simulate(position: Position, dS: float, dSigma: float, dDays: int) -> SimulationResult:
    """Simulate `position` under a scenario shock; return P&L + decomposition.

    dSigma is a PARALLEL IV shift: each option leg's own IV (override or
    position-level) moves by dSigma. Stock legs are unaffected by dSigma
    and dDays.
    """
    initial = position.greeks()
    new_S = position.S + dS

    actual_pnl = (position.price(S=new_S, dSigma=dSigma, days_elapsed=dDays)
                  - position.price())

    delta_c = initial.delta * dS
    gamma_c = 0.5 * initial.gamma * (dS ** 2)
    theta_c = initial.theta_per_day * dDays
    vega_c  = initial.vega_per_volpoint * (dSigma * 100)

    sum_c = delta_c + gamma_c + theta_c + vega_c
    residual = actual_pnl - sum_c

    new_greeks = position.greeks(S=new_S, dSigma=dSigma, days_elapsed=dDays)

    return SimulationResult(
        actual_pnl=actual_pnl,
        delta_contribution=delta_c,
        gamma_contribution=gamma_c,
        theta_contribution=theta_c,
        vega_contribution=vega_c,
        sum_of_components=sum_c,
        residual=residual,
        initial_greeks=initial,
        new_greeks=new_greeks,
    )
