"""
yfinance adapter with simple per-day disk cache.

Public functions:
  - get_chain_meta(ticker)            -> {ticker, spot, expiries, as_of}
  - get_chain(ticker, expiry)         -> {ticker, spot, expiry, calls, puts, as_of}

Cache strategy: one JSON file per (ticker, expiry, today). Refreshes daily.
"""
import json
import math
import time
from datetime import date
from pathlib import Path
from typing import Any

import yfinance as yf

CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)


def _cache_path(ticker: str, expiry: str | None = None) -> Path:
    today = date.today().isoformat()
    safe = ticker.upper().replace("/", "_")
    if expiry:
        return CACHE_DIR / f"{safe}_{expiry}_{today}.json"
    return CACHE_DIR / f"{safe}_meta_{today}.json"


def _now_utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _safe_int(x: Any, default: int = 0) -> int:
    try:
        v = float(x)
        if math.isnan(v) or math.isinf(v):
            return default
        return int(v)
    except (TypeError, ValueError):
        return default


def _get_spot(t: yf.Ticker) -> float:
    """Last close from a 1-day history. Throws if no data."""
    hist = t.history(period="1d")
    if hist.empty:
        raise RuntimeError("no price history returned")
    return _safe_float(hist["Close"].iloc[-1])


def get_chain_meta(ticker: str) -> dict[str, Any]:
    path = _cache_path(ticker)
    if path.exists():
        return json.loads(path.read_text())

    t = yf.Ticker(ticker)
    spot = _get_spot(t)
    expiries = list(t.options)
    data = {
        "ticker": ticker.upper(),
        "spot": spot,
        "expiries": expiries,
        "as_of": _now_utc(),
    }
    path.write_text(json.dumps(data, indent=2))
    return data


def get_chain(ticker: str, expiry: str) -> dict[str, Any]:
    path = _cache_path(ticker, expiry)
    if path.exists():
        return json.loads(path.read_text())

    t = yf.Ticker(ticker)
    spot = _get_spot(t)
    chain = t.option_chain(expiry)

    def _row(row) -> dict[str, Any]:
        bid = _safe_float(row.bid)
        ask = _safe_float(row.ask)
        last = _safe_float(row.lastPrice)
        if bid > 0 and ask > 0:
            mid = (bid + ask) / 2
        elif ask > 0:
            mid = ask
        elif bid > 0:
            mid = bid
        else:
            mid = last
        return {
            "strike": _safe_float(row.strike),
            "bid": bid,
            "ask": ask,
            "mid": mid,
            "last": last,
            "volume": _safe_int(row.volume),
            "open_interest": _safe_int(row.openInterest),
            "iv": _safe_float(row.impliedVolatility),
        }

    calls = [_row(r) for r in chain.calls.itertuples()]
    puts  = [_row(r) for r in chain.puts.itertuples()]

    data = {
        "ticker": ticker.upper(),
        "spot": spot,
        "expiry": expiry,
        "as_of": _now_utc(),
        "calls": calls,
        "puts": puts,
    }
    path.write_text(json.dumps(data, indent=2))
    return data
