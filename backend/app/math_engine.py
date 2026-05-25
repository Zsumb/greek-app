"""
Greeks Math Engine (pure module -- no side effects at import).

Provides:
  - bs_price, bs_greeks       : single-option pricing and Greeks
  - Greeks, Leg, Position     : data containers
  - simulate, SimulationResult: scenario simulator with P&L decomposition
"""
import math
from dataclasses import dataclass
from typing import Literal, Optional

from scipy.stats import norm


OptionType = Literal["call", "put"]
CONTRACT_MULTIPLIER = 100  # standard US equity option = 100 shares


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
    kind: OptionType
    strike: float
    expiry_days: int
    quantity: int


@dataclass
class Position:
    legs: list[Leg]
    S: float
    sigma: float
    r: float

    def price(self, S: Optional[float] = None, sigma: Optional[float] = None,
              days_elapsed: int = 0) -> float:
        S_use = S if S is not None else self.S
        sig_use = sigma if sigma is not None else self.sigma
        total = 0.0
        for leg in self.legs:
            T_rem = max(0.0, (leg.expiry_days - days_elapsed) / 365.0)
            per_share = bs_price(S_use, leg.strike, T_rem, self.r, sig_use, leg.kind)
            total += leg.quantity * per_share * CONTRACT_MULTIPLIER
        return total

    def greeks(self, S: Optional[float] = None, sigma: Optional[float] = None,
               days_elapsed: int = 0) -> Greeks:
        S_use = S if S is not None else self.S
        sig_use = sigma if sigma is not None else self.sigma
        agg = Greeks(0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        for leg in self.legs:
            T_rem = max(0.0, (leg.expiry_days - days_elapsed) / 365.0)
            g = bs_greeks(S_use, leg.strike, T_rem, self.r, sig_use, leg.kind)
            q = leg.quantity * CONTRACT_MULTIPLIER
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
    """Simulate `position` under a scenario shock; return P&L + decomposition."""
    initial = position.greeks()
    new_S = position.S + dS
    new_sigma = position.sigma + dSigma

    actual_pnl = position.price(S=new_S, sigma=new_sigma, days_elapsed=dDays) - position.price()

    delta_c = initial.delta * dS
    gamma_c = 0.5 * initial.gamma * (dS ** 2)
    theta_c = initial.theta_per_day * dDays
    vega_c  = initial.vega_per_volpoint * (dSigma * 100)

    sum_c = delta_c + gamma_c + theta_c + vega_c
    residual = actual_pnl - sum_c

    new_greeks = position.greeks(S=new_S, sigma=new_sigma, days_elapsed=dDays)

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
