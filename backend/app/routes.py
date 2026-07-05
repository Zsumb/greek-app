"""API endpoints. All position math runs locally; chain data fetched via yfinance."""
import numpy as np
from fastapi import APIRouter, HTTPException, Request

from datetime import date
from typing import Optional

from .schemas import (
    PositionIn,
    GreeksOut,
    LegPricesOut,
    PayoffRequest, PayoffPoint, PayoffOut,
    SimulateRequest, SimulateOut,
    ChainMetaOut, ChainOut,
    ExpiryItem, TickerSnapshotOut,
    ChatRequest, ChatResponse, ChatToolUse,
)
from .math_engine import Position, Leg, simulate, bs_price
from . import chat as chat_module

router = APIRouter()


def _to_position(p: PositionIn) -> Position:
    legs = [
        Leg(kind=l.kind, strike=l.strike, expiry_days=l.expiry_days,
            quantity=l.quantity, sigma=l.sigma, entry_price=l.entry_price)
        for l in p.legs
    ]
    return Position(legs=legs, S=p.S, sigma=p.sigma, r=p.r)


def _greeks_to_out(g) -> GreeksOut:
    return GreeksOut(
        price=g.price,
        delta=g.delta,
        gamma=g.gamma,
        theta_per_day=g.theta_per_day,
        vega_per_volpoint=g.vega_per_volpoint,
        rho_per_pct=g.rho_per_pct,
    )


# === Position math endpoints ===

@router.post("/position/greeks", response_model=GreeksOut,
             summary="Compute aggregated Greeks for a multi-leg position")
def position_greeks(position: PositionIn) -> GreeksOut:
    pos = _to_position(position)
    return _greeks_to_out(pos.greeks())


@router.post("/position/leg-prices", response_model=LegPricesOut,
             summary="Per-share model price for each leg (per-leg IV respected)")
def position_leg_prices(position: PositionIn) -> LegPricesOut:
    """Returns one per-share price per leg, in the input order. Multiply by
    100 × leg.quantity to get the per-leg cost / credit in dollars.
    Stock legs price at spot; option legs use their own IV when set."""
    pos = _to_position(position)
    prices = [pos.leg_model_price(leg) for leg in pos.legs]
    return LegPricesOut(prices=prices)


@router.post("/position/payoff", response_model=PayoffOut,
             summary="Payoff curve (today + at expiry) over a spot range")
def position_payoff(req: PayoffRequest) -> PayoffOut:
    pos = _to_position(req.position)
    initial = pos.price()
    # P&L is measured against COST BASIS (user's entry fills when provided,
    # model prices otherwise) so the curve matches the user's broker statement.
    basis = pos.cost_basis()
    smin = req.spot_min if req.spot_min is not None else req.position.S * 0.9
    smax = req.spot_max if req.spot_max is not None else req.position.S * 1.1
    if smax <= smin:
        raise HTTPException(status_code=400, detail="spot_max must be > spot_min")
    max_dte = max(leg.expiry_days for leg in req.position.legs)

    points = []
    for s in np.linspace(smin, smax, req.num_points):
        s = float(s)
        points.append(PayoffPoint(
            spot=s,
            pnl_today=pos.price(S=s) - basis,
            pnl_at_expiry=pos.price(S=s, days_elapsed=max_dte) - basis,
        ))
    return PayoffOut(initial_value=initial, cost_basis=basis, points=points)


@router.post("/position/simulate", response_model=SimulateOut,
             summary="Scenario simulator: P&L with Greek decomposition")
def position_simulate(req: SimulateRequest) -> SimulateOut:
    pos = _to_position(req.position)
    res = simulate(pos, dS=req.dS, dSigma=req.dSigma, dDays=req.dDays)
    return SimulateOut(
        actual_pnl=res.actual_pnl,
        delta_contribution=res.delta_contribution,
        gamma_contribution=res.gamma_contribution,
        theta_contribution=res.theta_contribution,
        vega_contribution=res.vega_contribution,
        sum_of_components=res.sum_of_components,
        residual=res.residual,
        initial_greeks=_greeks_to_out(res.initial_greeks),
        new_greeks=_greeks_to_out(res.new_greeks),
    )


# === Chain (market data) endpoints ===

@router.get("/chain/{ticker}", response_model=ChainMetaOut,
            summary="Spot price and available expiry dates for a ticker")
def chain_meta(ticker: str) -> ChainMetaOut:
    from .chain_data import get_chain_meta
    try:
        return ChainMetaOut(**get_chain_meta(ticker))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"chain meta fetch failed: {e}")


@router.get("/chain/{ticker}/{expiry}", response_model=ChainOut,
            summary="Full option chain (calls + puts) for a ticker at one expiry")
def chain_full(ticker: str, expiry: str) -> ChainOut:
    from .chain_data import get_chain
    try:
        return ChainOut(**get_chain(ticker, expiry))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"chain fetch failed: {e}")


@router.get("/ticker/{ticker}/snapshot", response_model=TickerSnapshotOut,
            summary="One-call snapshot: spot, expiries with DTE, and ATM-call IV")
def ticker_snapshot(ticker: str, expiry: Optional[str] = None) -> TickerSnapshotOut:
    """
    Wraps `chain_meta` + `chain_full` into one tidy payload for the frontend.
    If `expiry` is omitted, uses the nearest available expiry to source ATM IV.
    """
    from .chain_data import get_chain_meta, get_chain

    try:
        meta = get_chain_meta(ticker)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"snapshot meta failed: {e}")

    expiries_str = meta["expiries"]
    if not expiries_str:
        raise HTTPException(status_code=404, detail=f"no expiries available for {ticker}")

    today = date.today()
    expiry_items: list[ExpiryItem] = []
    for ex in expiries_str:
        try:
            ex_date = date.fromisoformat(ex)
        except ValueError:
            continue  # skip malformed
        expiry_items.append(ExpiryItem(date=ex, days_to_expiry=(ex_date - today).days))

    if expiry:
        chosen = expiry
        if chosen not in expiries_str:
            raise HTTPException(status_code=400, detail=f"unknown expiry {chosen}")
    else:
        # 0DTE IV is noisy; default to first expiry with DTE >= 1 if available.
        future = [item for item in expiry_items if item.days_to_expiry >= 1]
        chosen = (future[0].date if future else expiries_str[0])

    atm_strike: Optional[float] = None
    atm_iv: Optional[float] = None
    try:
        chain = get_chain(ticker, chosen)
        spot = chain["spot"]
        calls = chain.get("calls") or []
        if calls:
            nearest = min(calls, key=lambda c: abs(c["strike"] - spot))
            atm_strike = float(nearest["strike"])
            iv = float(nearest["iv"])
            atm_iv = iv if iv > 0.01 else None  # filter zero/noise
    except Exception:
        # Don't fail the whole snapshot just because chain fetch errors —
        # the user can still get spot + expiries and pick IV manually.
        pass

    return TickerSnapshotOut(
        ticker=ticker.upper(),
        spot=meta["spot"],
        as_of=meta["as_of"],
        expiries=expiry_items,
        atm_expiry=chosen,
        atm_strike=atm_strike,
        atm_iv=atm_iv,
    )


# === Chat (Claude-backed Q&A about the current position) ===

def _client_ip(request: Request) -> str:
    """Best-effort client IP — Railway sits behind a proxy that sets X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/chat", response_model=ChatResponse,
             summary="Free-form Q&A about the current position. Tool-augmented (calls the simulator).")
def chat_endpoint(req: ChatRequest, request: Request) -> ChatResponse:
    ip = _client_ip(request)
    allowed, used = chat_module.check_rate_limit(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit reached ({used} messages in the last hour). Try again later.",
        )

    position = _to_position(req.position)
    history = [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        result = chat_module.chat(history, position)
    except RuntimeError as e:
        # Most likely ANTHROPIC_API_KEY missing
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Chat failed: {e}")

    return ChatResponse(
        content=result["content"],
        tool_uses=[ChatToolUse(**tu) for tu in result["tool_uses"]],
        rate_used=used,
    )
