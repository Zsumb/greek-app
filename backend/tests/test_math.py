"""
Math engine tests. Mirror the walkthrough numbers from:
  OneDrive/AI Workspace/Personal Finance/greek education/
  2026-05-19_greeks-decomposition-walkthrough.md
"""
import math
import pytest

from app.math_engine import (
    bs_price, bs_greeks, Position, Leg, simulate, CONTRACT_MULTIPLIER,
)


# === Walkthrough position parameters (single source of truth) ===
S0, K0 = 500.0, 500.0
T0 = 30 / 365
R0 = 0.05
SIG0 = 0.20


@pytest.fixture
def walkthrough_call():
    """Long 1 SPY 500 call, 30 DTE, 20% IV — the canonical walkthrough position."""
    return Position(
        legs=[Leg(kind="call", strike=K0, expiry_days=30, quantity=1)],
        S=S0, sigma=SIG0, r=R0,
    )


# === Single-option pricing ===

def test_bs_price_atm_call_matches_walkthrough():
    price = bs_price(S0, K0, T0, R0, SIG0, "call")
    assert abs(price - 12.44) < 0.05


def test_bs_price_atm_put_via_parity():
    """Put-call parity: C - P = S - K*e^(-rT)"""
    c = bs_price(S0, K0, T0, R0, SIG0, "call")
    p = bs_price(S0, K0, T0, R0, SIG0, "put")
    expected_diff = S0 - K0 * math.exp(-R0 * T0)
    assert abs((c - p) - expected_diff) < 0.01


def test_bs_price_at_expiry_is_intrinsic():
    """T=0: price collapses to intrinsic value."""
    assert bs_price(510, 500, 0.0, 0.05, 0.20, "call") == 10.0
    assert bs_price(490, 500, 0.0, 0.05, 0.20, "call") == 0.0
    assert bs_price(490, 500, 0.0, 0.05, 0.20, "put") == 10.0
    assert bs_price(510, 500, 0.0, 0.05, 0.20, "put") == 0.0


# === Greeks ===

def test_greeks_atm_call_match_walkthrough():
    g = bs_greeks(S0, K0, T0, R0, SIG0, "call")
    assert abs(g.price - 12.44) < 0.05
    assert abs(g.delta - 0.5399) < 0.005
    assert abs(g.gamma - 0.01385) < 0.0005
    assert abs(g.theta_per_day - (-0.2249)) < 0.005
    assert abs(g.vega_per_volpoint - 0.5691) < 0.005


def test_put_delta_is_negative_below_one():
    g = bs_greeks(S0, K0, T0, R0, SIG0, "put")
    # ATM put delta: N(d1) - 1, roughly -0.46
    assert -1.0 < g.delta < 0.0


def test_call_and_put_gamma_are_equal():
    """Gamma is identical for calls and puts (same K, T, sigma)."""
    gc = bs_greeks(S0, K0, T0, R0, SIG0, "call")
    gp = bs_greeks(S0, K0, T0, R0, SIG0, "put")
    assert abs(gc.gamma - gp.gamma) < 1e-9


def test_call_and_put_vega_are_equal():
    """Vega is identical for calls and puts."""
    gc = bs_greeks(S0, K0, T0, R0, SIG0, "call")
    gp = bs_greeks(S0, K0, T0, R0, SIG0, "put")
    assert abs(gc.vega_per_volpoint - gp.vega_per_volpoint) < 1e-9


# === Position aggregation ===

def test_single_leg_position_scales_by_contract_multiplier(walkthrough_call):
    per_share = bs_greeks(S0, K0, T0, R0, SIG0, "call")
    pos = walkthrough_call.greeks()
    assert abs(pos.delta - per_share.delta * CONTRACT_MULTIPLIER) < 1e-6
    assert abs(pos.gamma - per_share.gamma * CONTRACT_MULTIPLIER) < 1e-6
    assert abs(pos.theta_per_day - per_share.theta_per_day * CONTRACT_MULTIPLIER) < 1e-6
    assert abs(pos.vega_per_volpoint - per_share.vega_per_volpoint * CONTRACT_MULTIPLIER) < 1e-6


def test_short_position_flips_signs(walkthrough_call):
    long_g = walkthrough_call.greeks()
    short = Position(
        legs=[Leg(kind="call", strike=K0, expiry_days=30, quantity=-1)],
        S=S0, sigma=SIG0, r=R0,
    )
    short_g = short.greeks()
    assert short_g.delta == pytest.approx(-long_g.delta)
    assert short_g.gamma == pytest.approx(-long_g.gamma)
    assert short_g.theta_per_day == pytest.approx(-long_g.theta_per_day)
    assert short_g.vega_per_volpoint == pytest.approx(-long_g.vega_per_volpoint)


def test_atm_straddle_delta_near_zero():
    """Long ATM call + put: delta is symmetric, slightly positive from drift."""
    straddle = Position(
        legs=[
            Leg(kind="call", strike=K0, expiry_days=30, quantity=1),
            Leg(kind="put",  strike=K0, expiry_days=30, quantity=1),
        ],
        S=S0, sigma=SIG0, r=R0,
    )
    g = straddle.greeks()
    assert abs(g.delta) < 15      # near zero (within $15 of zero per contract pair)
    assert g.gamma > 0            # long gamma
    assert g.theta_per_day < 0    # pays decay
    assert g.vega_per_volpoint > 0  # long vol


# === Scenario decomposition ===

def test_simulate_walkthrough_scenario(walkthrough_call):
    """+$5 spot, -1 vol-point, +5 days forward — the canonical walkthrough."""
    res = simulate(walkthrough_call, dS=5.0, dSigma=-0.01, dDays=5)
    assert res.actual_pnl == pytest.approx(120.0, abs=1.0)
    assert res.delta_contribution == pytest.approx(269.95, abs=0.5)
    assert res.gamma_contribution == pytest.approx(17.31, abs=0.5)
    assert res.theta_contribution == pytest.approx(-112.45, abs=0.5)
    assert res.vega_contribution == pytest.approx(-56.91, abs=0.5)
    assert res.residual == pytest.approx(2.10, abs=1.5)


def test_simulate_zero_shock_yields_zero_pnl(walkthrough_call):
    res = simulate(walkthrough_call, dS=0.0, dSigma=0.0, dDays=0)
    assert abs(res.actual_pnl) < 1e-6
    assert abs(res.sum_of_components) < 1e-6
    assert abs(res.residual) < 1e-6


def test_simulate_components_sum_plus_residual_equals_actual(walkthrough_call):
    res = simulate(walkthrough_call, dS=3.0, dSigma=-0.02, dDays=7)
    assert res.actual_pnl == pytest.approx(res.sum_of_components + res.residual, abs=1e-6)


def test_decomposition_residual_grows_with_move_size(walkthrough_call):
    """Bigger spot moves -> bigger absolute residual (higher-order effects)."""
    small = simulate(walkthrough_call, dS=2.0, dSigma=0.0, dDays=0)
    big   = simulate(walkthrough_call, dS=30.0, dSigma=0.0, dDays=0)
    assert abs(big.residual) > abs(small.residual)


# ===========================================================================
# === Matrix additions (Phase 1: A, B, C, E sections — P0 + P1) ===
# ===========================================================================


# === A. Black-Scholes pricing — additional cases ===

def test_A4_deep_itm_call_dominated_by_intrinsic():
    """Deep ITM call: price ≈ intrinsic + small time value."""
    price = bs_price(600.0, 500.0, 30 / 365, R0, SIG0, "call")
    intrinsic = 600.0 - 500.0
    # Should be just slightly above intrinsic (TV is small for deep ITM)
    assert price > intrinsic
    assert price - intrinsic < 5.0


def test_A5_deep_otm_put_near_zero():
    """Deep OTM put (spot >> strike): price near zero."""
    price = bs_price(600.0, 400.0, 30 / 365, R0, SIG0, "put")
    assert 0.0 <= price < 0.50


# === B. Single-option Greeks — additional cases ===

def test_B5_long_call_rho_positive():
    """ρ > 0 for calls — higher rates make calls slightly more valuable."""
    g = bs_greeks(S0, K0, T0, R0, SIG0, "call")
    assert g.rho_per_pct > 0


def test_B6_long_put_rho_negative():
    """ρ < 0 for puts — higher rates make puts slightly less valuable."""
    g = bs_greeks(S0, K0, T0, R0, SIG0, "put")
    assert g.rho_per_pct < 0


def test_B7_rho_grows_with_tenor():
    """ρ magnitude scales with √T-ish — long-dated options have larger ρ."""
    g_30d = bs_greeks(S0, K0, 30 / 365, R0, SIG0, "call")
    g_365d = bs_greeks(S0, K0, 365 / 365, R0, SIG0, "call")
    assert g_365d.rho_per_pct > g_30d.rho_per_pct * 5  # ~10× expected, generous bound


# === C. Multi-leg aggregation — additional cases ===

def test_C4_iron_condor_greek_signs():
    """Short-premium iron condor: Δ≈0, Γ<0, Θ>0, Vega<0."""
    pos = Position(
        legs=[
            Leg(kind="put",  strike=480, expiry_days=30, quantity=1),
            Leg(kind="put",  strike=490, expiry_days=30, quantity=-1),
            Leg(kind="call", strike=510, expiry_days=30, quantity=-1),
            Leg(kind="call", strike=520, expiry_days=30, quantity=1),
        ],
        S=S0, sigma=SIG0, r=R0,
    )
    g = pos.greeks()
    assert abs(g.delta) < 20         # delta-neutral by design
    assert g.gamma < 0               # short gamma (short the inner strikes)
    assert g.theta_per_day > 0       # collect decay
    assert g.vega_per_volpoint < 0   # short vol — benefit from IV crush


def test_C5_bull_call_spread_directional():
    """Bull call spread: positive delta, positive theta later (debit, capped)."""
    pos = Position(
        legs=[
            Leg(kind="call", strike=K0,        expiry_days=30, quantity=1),
            Leg(kind="call", strike=K0 + 10,   expiry_days=30, quantity=-1),
        ],
        S=S0, sigma=SIG0, r=R0,
    )
    g = pos.greeks()
    assert g.delta > 0                 # net long delta
    # The single long call alone has Δ ≈ 54; shorting a higher-strike call
    # caps the upside, so net delta is meaningfully smaller.
    long_only_delta = bs_greeks(S0, K0, T0, R0, SIG0, "call").delta * CONTRACT_MULTIPLIER
    assert g.delta < long_only_delta


# === E. Scenario decomposition — additional cases ===

def test_E5_pure_time_decay_isolates_theta(walkthrough_call):
    """dS=0, dSigma=0, dDays>0 → only theta_contribution non-zero (others zero)."""
    res = simulate(walkthrough_call, dS=0.0, dSigma=0.0, dDays=5)
    assert res.delta_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.gamma_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.vega_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.theta_contribution != pytest.approx(0.0, abs=1.0)  # nontrivial
    assert res.theta_contribution < 0  # long-call long-premium loses to decay


def test_E6_pure_iv_shock_isolates_vega(walkthrough_call):
    """dSigma!=0, others zero → only vega_contribution non-zero."""
    res = simulate(walkthrough_call, dS=0.0, dSigma=-0.02, dDays=0)
    assert res.delta_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.gamma_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.theta_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.vega_contribution != pytest.approx(0.0, abs=1.0)
    assert res.vega_contribution < 0  # long-vol position, IV down hurts


def test_E7_pure_spot_shock_zeroes_theta_and_vega(walkthrough_call):
    """dS!=0 with dDays=0, dSigma=0 → Δ and Γ contribute; Θ and Vega contribs = 0."""
    res = simulate(walkthrough_call, dS=5.0, dSigma=0.0, dDays=0)
    assert res.theta_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.vega_contribution == pytest.approx(0.0, abs=1e-6)
    assert res.delta_contribution > 0     # +$5 with positive delta
    assert res.gamma_contribution > 0     # convexity adds


def test_E8_negative_spot_shock_long_call_loses(walkthrough_call):
    """Negative dS on a long call → actual P&L < 0."""
    res = simulate(walkthrough_call, dS=-10.0, dSigma=0.0, dDays=0)
    assert res.actual_pnl < 0
    assert res.delta_contribution < 0     # Δ contribution flips sign with dS


def test_E10_long_straddle_iv_crush_loses_money():
    """Long ATM straddle: pure IV crush should produce a large negative P&L (vega-driven)."""
    straddle = Position(
        legs=[
            Leg(kind="call", strike=K0, expiry_days=30, quantity=1),
            Leg(kind="put",  strike=K0, expiry_days=30, quantity=1),
        ],
        S=S0, sigma=SIG0, r=R0,
    )
    res = simulate(straddle, dS=0.0, dSigma=-0.05, dDays=0)  # 5 vol-pts IV crush
    assert res.actual_pnl < 0
    assert res.vega_contribution < 0
    # Vega should be the dominant driver here (no spot/time shock)
    assert abs(res.vega_contribution) > abs(res.delta_contribution)
    assert abs(res.vega_contribution) > abs(res.theta_contribution)
