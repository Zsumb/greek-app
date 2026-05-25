"""
01_math_engine.py — validate the math engine against the walkthrough scenario.

Imports the pure module `math_engine.py` and runs the assertions from:
  ../../OneDrive/AI Workspace/Personal Finance/greek education/
  2026-05-19_greeks-decomposition-walkthrough.md

Run:  python 01_math_engine.py
Cell-by-cell: open in VS Code or Jupyter (cells delimited with # %%).
"""

# %%
from math_engine import Position, Leg, simulate, bs_greeks


# %%
# === Section 3: validate single-option Greeks ===
# Long SPY ATM call: S=500, K=500, T=30 days, sigma=0.20, r=0.05

g0 = bs_greeks(S=500.0, K=500.0, T=30/365, r=0.05, sigma=0.20, kind="call")

print("Walkthrough single-option check (per share):")
print(f"  Price:               ${g0.price:>9.4f}   (expected ~ 12.44)")
print(f"  Delta:                {g0.delta:>9.4f}   (expected ~ 0.5399)")
print(f"  Gamma:                {g0.gamma:>9.5f}   (expected ~ 0.01385)")
print(f"  Theta (per day):      {g0.theta_per_day:>9.4f}   (expected ~ -0.2249)")
print(f"  Vega (per vol-pt):    {g0.vega_per_volpoint:>9.4f}   (expected ~ 0.5691)")

assert abs(g0.price - 12.44) < 0.05
assert abs(g0.delta - 0.5399) < 0.005
assert abs(g0.gamma - 0.01385) < 0.0005
assert abs(g0.theta_per_day - (-0.2249)) < 0.005
assert abs(g0.vega_per_volpoint - 0.5691) < 0.005
print("[OK] Section 3 -- initial Greeks match walkthrough.\n")


# %%
# === Section 6: validate decomposition for the walkthrough scenario ===

pos = Position(
    legs=[Leg(kind="call", strike=500, expiry_days=30, quantity=1)],
    S=500.0, sigma=0.20, r=0.05,
)
res = simulate(pos, dS=5.0, dSigma=-0.01, dDays=5)

print("Scenario: +$5 spot, -1 vol-point, 5 days forward")
print("-" * 56)
print(f"  Actual P&L:           ${res.actual_pnl:>9.2f}   (expected ~ +$120)")
print(f"  Delta contribution:   ${res.delta_contribution:>9.2f}   (expected ~ +$269.95)")
print(f"  Gamma contribution:   ${res.gamma_contribution:>9.2f}   (expected ~ +$17.31)")
print(f"  Theta contribution:   ${res.theta_contribution:>9.2f}   (expected ~ -$112.45)")
print(f"  Vega contribution:    ${res.vega_contribution:>9.2f}   (expected ~ -$56.91)")
print(f"  Sum of components:    ${res.sum_of_components:>9.2f}   (expected ~ +$117.90)")
print(f"  Residual:             ${res.residual:>9.2f}   (expected ~ +$2.10)")

assert abs(res.actual_pnl - 120.00) < 1.0
assert abs(res.delta_contribution - 269.95) < 0.5
assert abs(res.gamma_contribution - 17.31) < 0.5
assert abs(res.theta_contribution - (-112.45)) < 0.5
assert abs(res.vega_contribution - (-56.91)) < 0.5
assert abs(res.residual - 2.10) < 1.5
print("[OK] Section 6 -- decomposition matches walkthrough.\n")


# %%
# === Section 7: stress test (5% move) ===

stress = simulate(pos, dS=25.0, dSigma=-0.01, dDays=5)
pct = 100 * stress.residual / stress.actual_pnl
print("Stress: +$25 spot (5% move), -1 vol-point, 5 days forward")
print("-" * 56)
print(f"  Actual P&L:           ${stress.actual_pnl:>9.2f}")
print(f"  Sum of components:    ${stress.sum_of_components:>9.2f}")
print(f"  Residual:             ${stress.residual:>9.2f}   ({pct:.1f}% of actual)\n")


# %%
# === Section 8: long ATM straddle sanity ===

straddle = Position(
    legs=[
        Leg(kind="call", strike=500, expiry_days=30, quantity=1),
        Leg(kind="put",  strike=500, expiry_days=30, quantity=1),
    ],
    S=500.0, sigma=0.20, r=0.05,
)
gs = straddle.greeks()
print("Long ATM Straddle (1 call + 1 put):")
print(f"  Net Delta:            {gs.delta:>9.2f}   (near zero -- symmetric)")
print(f"  Net Gamma:            {gs.gamma:>9.4f}   (positive -- long vol)")
print(f"  Net Theta per day:   ${gs.theta_per_day:>9.2f}   (negative -- pays decay)")
print(f"  Net Vega per vol-pt: ${gs.vega_per_volpoint:>9.2f}   (positive -- long IV)")

assert abs(gs.delta) < 15
assert gs.gamma > 0
assert gs.vega_per_volpoint > 0
assert gs.theta_per_day < 0
print("[OK] Section 8 -- straddle Greeks behave correctly.\n")


# %%
print("=" * 56)
print("Phase 0 complete: math engine validated.")
print("=" * 56)
