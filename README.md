# Options Greeks Playground

> **Every options trade tells a story. This tool lets you read it.**
> See the breakdown of your option P&L into **Δ / Γ / Θ / Vega** contributions
> in dollars — before you trade.

A full-stack web app for retail options traders who want to *internalize* the
Greeks instead of memorizing them. Build any position, fetch live US market
data, scrub a time-machine simulator, and see exactly how each Greek moves
your P&L — in dollars, not formulas.

---

## Why use this

Most free options tools show you the payoff diagram. They don't tell you
**why** the line moves the way it does. This one does:

- **P&L Decomposition.** For any scenario, break P&L into Δ / Γ / Θ / Vega
  contributions in dollars, with the formula visible (`Δ × dS = 54 × $10`).
- **Time-machine simulation.** Move time forward, shock the underlying, jolt
  IV — see how *your* position responds.
- **Live market data.** Type a US ticker → live spot, expiries, and ATM IV
  flow into the builder. Strikes auto-snap.
- **Educational framing.** Every change in a Greek comes with a one-line
  interpretation ("Each $1 spot move now adjusts delta by 5.90 more —
  position more reactive").
- **Strategy presets.** Long call, long put, long straddle, bull call spread,
  iron condor — plus a custom builder.

**Not a trading platform.** No order routing, no real-time tick data, no
portfolio tracking. Educational only.

---

## Tech stack

**Backend** (`backend/`)
- Python 3.11+, FastAPI, Pydantic
- Black-Scholes pricer + Greeks (custom implementation; no `py_vollib`)
- yfinance adapter with disk cache for chain data
- pytest (26 tests)

**Frontend** (`frontend/`)
- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui components
- TanStack Query (server state) + Zustand (position state)
- Plotly.js (payoff chart)
- Typed API client auto-generated from FastAPI's OpenAPI spec

**Phase 0** (`notebooks/`)
- Math engine prototyping: Black-Scholes pricer, Greeks, multi-leg
  aggregator, scenario simulator with P&L decomposition
- Visualizations (matplotlib) used to validate the engine

---

## Surfaces

| Card | Purpose |
|---|---|
| **Strategy Builder** | Pick a preset or add custom legs (call/put · strike · expiry · qty). Fetch a US ticker to autofill spot + expiries + IV. |
| **Live Greeks** | Δ, Γ, Θ, Vega, Rho aggregated across legs, per contract (×100). |
| **What each Greek means** | Modal with plain-English definitions. |
| **Payoff & Trade Summary** | Today vs. expiry P&L curve (Plotly). Net debit/credit, max profit, max loss, breakevens. |
| **Time Machine** | Days / spot / IV sliders + 4 preset scenarios + custom scenario dialog. P&L decomposition with bars *and* the formula that produced each contribution. |
| **Greeks at scenario** | Initial vs. after table with directional arrow + per-Greek "what this means" subtitle. |

---

## Run locally

### Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
# http://127.0.0.1:8000/docs
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
# http://localhost:3000
```

The frontend reads `NEXT_PUBLIC_API_BASE_URL` from `.env.local`; defaults to
`http://127.0.0.1:8000` if unset.

### Tests

```powershell
cd backend
python -m pytest -m "not network"   # 26 unit tests, no live yfinance
```

---

## Project structure

```
greek-app/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI entrypoint + CORS
│   │   ├── routes.py          All endpoints
│   │   ├── schemas.py         Pydantic models (drives OpenAPI)
│   │   ├── math_engine.py     Black-Scholes + Greeks + scenario sim
│   │   ├── chain_data.py      yfinance adapter (cached)
│   │   └── cache/             on-disk cache (gitignored)
│   ├── tests/                 pytest suite
│   ├── requirements.txt
│   └── Dockerfile             for Railway / any container host
├── frontend/
│   ├── src/
│   │   ├── app/               Next.js App Router pages
│   │   ├── components/        Strategy builder, Live Greeks, Payoff chart,
│   │   │                      Time machine, dialogs, etc.
│   │   ├── components/ui/     shadcn components
│   │   └── lib/
│   │       ├── api.ts         typed fetch client
│   │       ├── api-types.ts   auto-generated from /openapi.json
│   │       ├── store.ts       Zustand position store
│   │       ├── presets.ts     5 named strategies
│   │       └── payoff-summary.ts  max P/L, breakevens, etc.
│   ├── package.json
│   └── .env.local             API base URL (gitignored)
└── notebooks/
    ├── math_engine.py         Importable Phase-0 module
    ├── 01_math_engine.py      Validation script (matches walkthrough)
    └── 02_visualizations.py   matplotlib sanity charts
```

---

## Math validation

The engine reproduces a canonical walkthrough scenario:

> Long 1 SPY 500 call · 30 DTE · σ = 20% · r = 5%
> Apply: +$5 spot, −1 vol-pt, +5 days forward

Expected (and produced) per contract:

| Component | Value |
|---|---|
| Actual P&L | **+$120** |
| Δ contribution | +$269.95 |
| Γ contribution | +$17.31 |
| Θ contribution | −$112.45 |
| Vega contribution | −$56.91 |
| Sum of components | +$117.90 |
| Residual (higher-order) | +$2.10 |

All 26 tests pass — see `backend/tests/`.

---

## Deployment

Recommended targets:
- **Frontend → Vercel** (free tier, GitHub-integrated, auto-deploy on push)
- **Backend → Railway** (free trial, Dockerfile-based)

Step-by-step instructions in [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Roadmap

- [ ] User feedback round (10 retail traders)
- [ ] Save positions to localStorage / cloud account
- [ ] Historical replay (pick a real past date, replay how Greeks evolved)
- [ ] Side-by-side strategy comparison
- [ ] Earnings calendar overlay
- [ ] American-style early exercise (vs. European-only today)

---

## Credits

Built by **Sumbul Amin** with **Claude**. Educational only — not trading
advice.
