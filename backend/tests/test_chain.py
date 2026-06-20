"""
Chain / ticker snapshot tests.

Live yfinance calls are flaky and slow, so the G1/G2/G3 tests that hit the
network are marked `@pytest.mark.network` and skipped by default. Run them
explicitly with:  pytest -m network

The G4/G5 tests use the test client against the (live) snapshot endpoint
because the date-arithmetic and ATM-IV-selection logic lives in the route
handler — there's no pure function to call. They're also marked `network`.

To run network tests only:  pytest -m network
To run everything:           pytest -m "network or not network"
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


# === G1, G2, G4, G5 — live network ===


@pytest.mark.network
def test_G1_valid_ticker_returns_snapshot(client):
    """SPY snapshot: spot > 0, expiries list non-empty, ATM IV usually present."""
    r = client.get("/ticker/SPY/snapshot")
    assert r.status_code == 200
    body = r.json()
    assert body["ticker"] == "SPY"
    assert body["spot"] > 0
    assert len(body["expiries"]) >= 1
    # ATM IV may legitimately be None for low-liquidity tickers, but SPY
    # always has it — treat that as a sanity check.
    if body["atm_iv"] is not None:
        assert 0.01 < body["atm_iv"] < 2.0  # 1% – 200% IV is sane


@pytest.mark.network
def test_G2_invalid_ticker_returns_sensible_error(client):
    """Garbage ticker: backend should return a non-200, not crash."""
    r = client.get("/ticker/THIS_TICKER_DOES_NOT_EXIST_XYZ/snapshot")
    # Acceptable: 404 (no expiries), 502 (yfinance error), 400 (bad request).
    assert r.status_code >= 400
    # Body should mention some error context, not be empty
    assert r.json().get("detail")


@pytest.mark.network
def test_G4_expiry_items_have_correct_dte(client):
    """Each returned expiry's days_to_expiry == (expiry_date - today)."""
    r = client.get("/ticker/SPY/snapshot")
    assert r.status_code == 200
    today = date.today()
    for item in r.json()["expiries"]:
        expected = (date.fromisoformat(item["date"]) - today).days
        assert item["days_to_expiry"] == expected, (
            f"DTE mismatch for {item['date']}: "
            f"got {item['days_to_expiry']}, expected {expected}"
        )


@pytest.mark.network
def test_G5_default_atm_expiry_skips_0dte(client):
    """When no `expiry` query param: default to first non-0DTE expiry for ATM IV.

    Rationale: 0DTE IV is noisy and unrepresentative; we'd rather pin to a
    nearby weekly. If only 0DTE is available, we fall back to it.
    """
    r = client.get("/ticker/SPY/snapshot")
    assert r.status_code == 200
    body = r.json()
    chosen = body["atm_expiry"]
    if chosen is None:
        return  # nothing to assert
    # Find the chosen expiry's DTE
    chosen_dte = next(
        item["days_to_expiry"] for item in body["expiries"] if item["date"] == chosen
    )
    # If any future expiries (DTE >= 1) were available, the chosen one must be ≥ 1.
    if any(item["days_to_expiry"] >= 1 for item in body["expiries"]):
        assert chosen_dte >= 1, f"Default ATM expiry should skip 0DTE, got DTE={chosen_dte}"
