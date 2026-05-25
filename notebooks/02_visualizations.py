"""
02_visualizations.py — visual sanity checks for the math engine.

Generates four charts (saved to ./figures/):
  1. Payoff curve — today vs at expiry
  2. Greek profiles — Delta/Gamma/Theta/Vega as functions of spot
  3. P&L decomposition — bar chart for the walkthrough scenario
  4. Time decay — payoff at multiple DTEs

Run: python 02_visualizations.py
"""

# %%
import os
import numpy as np
import matplotlib.pyplot as plt

from math_engine import Position, Leg, simulate

FIGURES_DIR = os.path.join(os.path.dirname(__file__), "figures")
os.makedirs(FIGURES_DIR, exist_ok=True)


# %%
# === Setup the walkthrough position: long 1 SPY 500 call, 30 DTE, 20% IV ===

pos = Position(
    legs=[Leg(kind="call", strike=500, expiry_days=30, quantity=1)],
    S=500.0, sigma=0.20, r=0.05,
)
initial_value = pos.price()
spots = np.linspace(450, 550, 201)


# %%
# === Chart 1: Payoff curve (today vs at expiry) ===

pnl_today  = [pos.price(S=s) - initial_value for s in spots]
pnl_expiry = [pos.price(S=s, days_elapsed=30) - initial_value for s in spots]

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(spots, pnl_today,  label="P&L today (30 DTE)", linewidth=2)
ax.plot(spots, pnl_expiry, label="P&L at expiry",      linewidth=2, linestyle="--")
ax.axhline(0,   color="gray", linewidth=0.6)
ax.axvline(500, color="gray", linewidth=0.6, linestyle=":", label="Strike $500")
ax.set_xlabel("SPY price ($)")
ax.set_ylabel("Position P&L ($)")
ax.set_title("Long 1 SPY 500 Call -- Payoff Curve")
ax.legend()
ax.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(os.path.join(FIGURES_DIR, "01_payoff_curve.png"), dpi=120)
plt.close(fig)


# %%
# === Chart 2: Greek profiles across spot prices ===

deltas, gammas, thetas, vegas = [], [], [], []
for s in spots:
    g = pos.greeks(S=s)
    deltas.append(g.delta)
    gammas.append(g.gamma)
    thetas.append(g.theta_per_day)
    vegas.append(g.vega_per_volpoint)

fig, axes = plt.subplots(2, 2, figsize=(12, 8))
panels = [
    (deltas, "Delta (dollar delta per $1 move)",       "$ delta",              axes[0, 0]),
    (gammas, "Gamma (delta change per $1 move)",       "$ gamma",              axes[0, 1]),
    (thetas, "Theta (P&L per day)",                    "$ / day",              axes[1, 0]),
    (vegas,  "Vega (P&L per 1 vol-point)",             "$ / vol-pt",           axes[1, 1]),
]
for vals, title, ylabel, ax in panels:
    ax.plot(spots, vals, linewidth=2)
    ax.axvline(500, color="gray", linewidth=0.6, linestyle=":")
    ax.axhline(0,   color="gray", linewidth=0.6)
    ax.set_xlabel("SPY price ($)")
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    ax.grid(True, alpha=0.3)
fig.suptitle("Long 1 SPY 500 Call (30 DTE, 20% IV) -- Greek profiles", fontsize=14)
fig.tight_layout()
fig.savefig(os.path.join(FIGURES_DIR, "02_greek_profiles.png"), dpi=120)
plt.close(fig)


# %%
# === Chart 3: P&L decomposition for the walkthrough scenario ===

res = simulate(pos, dS=5.0, dSigma=-0.01, dDays=5)
labels = ["Delta", "Gamma", "Theta", "Vega", "Residual"]
vals   = [res.delta_contribution, res.gamma_contribution,
          res.theta_contribution, res.vega_contribution, res.residual]
colors = ["#2ecc71" if v >= 0 else "#e74c3c" for v in vals]

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.bar(labels, vals, color=colors, edgecolor="black", linewidth=0.8)
ax.axhline(0, color="gray", linewidth=0.6)
ax.set_ylabel("Contribution to P&L ($)")
ax.set_title(
    f"P&L Decomposition -- Scenario: +\\$5 spot, -1 vol-pt, +5 days\n"
    f"Actual P&L = \\${res.actual_pnl:+.2f}   |   "
    f"Sum of components = \\${res.sum_of_components:+.2f}"
)
for bar, v in zip(bars, vals):
    offset = 6 if v >= 0 else -16
    ax.annotate(f"\\${v:+.2f}",
                xy=(bar.get_x() + bar.get_width() / 2, v),
                xytext=(0, offset), textcoords="offset points",
                ha="center", fontsize=11, fontweight="bold")
ax.grid(True, alpha=0.3, axis="y")
fig.tight_layout()
fig.savefig(os.path.join(FIGURES_DIR, "03_decomposition.png"), dpi=120)
plt.close(fig)


# %%
# === Chart 4: Time decay -- payoff at multiple DTEs ===

dte_snapshots = [30, 21, 14, 7, 1]  # 1 instead of 0 to avoid intrinsic-only edge
fig, ax = plt.subplots(figsize=(10, 6))
for dte in dte_snapshots:
    days_elapsed = 30 - dte
    pnl = [pos.price(S=s, days_elapsed=days_elapsed) - initial_value for s in spots]
    ax.plot(spots, pnl, label=f"{dte} DTE", linewidth=2)

# Plus expiration line (intrinsic)
ax.plot(spots, pnl_expiry, label="Expiration", linewidth=2,
        linestyle="--", color="black")
ax.axhline(0,   color="gray", linewidth=0.6)
ax.axvline(500, color="gray", linewidth=0.6, linestyle=":")
ax.set_xlabel("SPY price ($)")
ax.set_ylabel("Position P&L ($)")
ax.set_title("Long 1 SPY 500 Call -- Time Decay (P&L curve shrinking toward expiry)")
ax.legend(title="Days to expiry")
ax.grid(True, alpha=0.3)
fig.tight_layout()
fig.savefig(os.path.join(FIGURES_DIR, "04_time_decay.png"), dpi=120)
plt.close(fig)


# %%
# === Done ===
print(f"Charts saved to: {FIGURES_DIR}")
for f in sorted(os.listdir(FIGURES_DIR)):
    full = os.path.join(FIGURES_DIR, f)
    size_kb = os.path.getsize(full) / 1024
    print(f"  {f}  ({size_kb:.0f} KB)")
