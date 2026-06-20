"""
API endpoint tests using FastAPI TestClient (no network).
Chain endpoints (yfinance-backed) are marked `network` and skipped by default.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


WALKTHROUGH_POSITION = {
    "S": 500.0,
    "sigma": 0.20,
    "r": 0.05,
    "legs": [{"kind": "call", "strike": 500, "expiry_days": 30, "quantity": 1}],
}


# === Service identity ===

def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "Greeks Education API"


def test_openapi_schema_published(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/position/greeks" in paths
    assert "/position/payoff" in paths
    assert "/position/simulate" in paths


# === /position/greeks ===

def test_position_greeks_walkthrough(client):
    r = client.post("/position/greeks", json=WALKTHROUGH_POSITION)
    assert r.status_code == 200
    g = r.json()
    assert g["delta"] == pytest.approx(53.99, abs=0.5)
    assert g["gamma"] == pytest.approx(1.385, abs=0.05)
    assert g["theta_per_day"] == pytest.approx(-22.49, abs=0.5)
    assert g["vega_per_volpoint"] == pytest.approx(56.91, abs=0.5)


def test_position_greeks_rejects_empty_legs(client):
    bad = {**WALKTHROUGH_POSITION, "legs": []}
    r = client.post("/position/greeks", json=bad)
    assert r.status_code == 422


def test_position_greeks_rejects_negative_strike(client):
    bad = {
        **WALKTHROUGH_POSITION,
        "legs": [{"kind": "call", "strike": -100, "expiry_days": 30, "quantity": 1}],
    }
    r = client.post("/position/greeks", json=bad)
    assert r.status_code == 422


def test_position_greeks_rejects_invalid_kind(client):
    bad = {
        **WALKTHROUGH_POSITION,
        "legs": [{"kind": "banana", "strike": 500, "expiry_days": 30, "quantity": 1}],
    }
    r = client.post("/position/greeks", json=bad)
    assert r.status_code == 422


# === /position/payoff ===

def test_position_payoff_returns_curve(client):
    r = client.post("/position/payoff", json={
        "position": WALKTHROUGH_POSITION,
        "num_points": 21,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["points"]) == 21
    assert body["initial_value"] == pytest.approx(1246.69, abs=2.0)

    # At expiry below strike: max loss = -premium
    pt_low = body["points"][0]
    assert pt_low["pnl_at_expiry"] == pytest.approx(-body["initial_value"], abs=2.0)

    # At expiry well above strike: pnl_at_expiry > pnl_today (no time value above strike)
    pt_high = body["points"][-1]
    assert pt_high["pnl_today"] > pt_high["pnl_at_expiry"]


def test_position_payoff_custom_spot_range(client):
    r = client.post("/position/payoff", json={
        "position": WALKTHROUGH_POSITION,
        "spot_min": 480,
        "spot_max": 520,
        "num_points": 41,
    })
    assert r.status_code == 200
    pts = r.json()["points"]
    assert pts[0]["spot"] == pytest.approx(480.0)
    assert pts[-1]["spot"] == pytest.approx(520.0)


def test_position_payoff_rejects_inverted_range(client):
    r = client.post("/position/payoff", json={
        "position": WALKTHROUGH_POSITION,
        "spot_min": 520,
        "spot_max": 480,
    })
    assert r.status_code == 400


# === /position/simulate ===

def test_position_simulate_walkthrough(client):
    r = client.post("/position/simulate", json={
        "position": WALKTHROUGH_POSITION,
        "dS": 5.0,
        "dSigma": -0.01,
        "dDays": 5,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["actual_pnl"] == pytest.approx(120.0, abs=1.0)
    assert body["delta_contribution"] == pytest.approx(269.95, abs=0.5)
    assert body["gamma_contribution"] == pytest.approx(17.31, abs=0.5)
    assert body["theta_contribution"] == pytest.approx(-112.45, abs=0.5)
    assert body["vega_contribution"] == pytest.approx(-56.91, abs=0.5)
    assert body["residual"] == pytest.approx(2.10, abs=1.5)
    # Round-trip: sum + residual == actual
    parts = (body["delta_contribution"] + body["gamma_contribution"]
             + body["theta_contribution"] + body["vega_contribution"])
    assert parts + body["residual"] == pytest.approx(body["actual_pnl"], abs=1e-6)


def test_position_simulate_zero_shock(client):
    r = client.post("/position/simulate", json={"position": WALKTHROUGH_POSITION})
    body = r.json()
    assert body["actual_pnl"] == pytest.approx(0.0, abs=1e-6)
    assert body["sum_of_components"] == pytest.approx(0.0, abs=1e-6)


def test_position_simulate_returns_both_greeks(client):
    r = client.post("/position/simulate", json={
        "position": WALKTHROUGH_POSITION,
        "dS": 10.0, "dSigma": -0.02, "dDays": 7,
    })
    body = r.json()
    # New greeks reflect the moved state: more delta after stock rallies
    assert body["new_greeks"]["delta"] > body["initial_greeks"]["delta"]


# === Chain endpoints (yfinance — opt-in) ===

@pytest.mark.network
def test_chain_meta_live_spy(client):
    r = client.get("/chain/SPY")
    assert r.status_code == 200
    body = r.json()
    assert body["ticker"] == "SPY"
    assert body["spot"] > 0
    assert len(body["expiries"]) > 0


# ===========================================================================
# === Matrix additions (Phase 1: D, F sections) ===
# ===========================================================================


# === D1, D2, D12 — payoff curve shape & accounting ===

def test_D1_long_call_payoff_at_expiry_kink(client):
    """Long call at expiry: P&L = max(S−K, 0)·100 − premium. Slope +100 above strike."""
    r = client.post("/position/payoff", json={
        "position": WALKTHROUGH_POSITION,
        "spot_min": 460,
        "spot_max": 540,
        "num_points": 81,  # one point per dollar
    })
    body = r.json()
    pts = {round(p["spot"]): p for p in body["points"]}
    initial = body["initial_value"]
    # Below strike at expiry: P&L = -premium (constant)
    assert pts[480]["pnl_at_expiry"] == pytest.approx(-initial, abs=1.0)
    assert pts[490]["pnl_at_expiry"] == pytest.approx(-initial, abs=1.0)
    # At strike: still ≈ -premium (intrinsic zero)
    assert pts[500]["pnl_at_expiry"] == pytest.approx(-initial, abs=1.0)
    # Above strike: linear slope +100 per $1
    assert pts[510]["pnl_at_expiry"] - pts[500]["pnl_at_expiry"] == pytest.approx(1000.0, abs=1.0)
    assert pts[520]["pnl_at_expiry"] - pts[510]["pnl_at_expiry"] == pytest.approx(1000.0, abs=1.0)


def test_D2_long_put_payoff_at_expiry_kink(client):
    """Long put at expiry: linear slope −100 below strike, flat at −premium above."""
    long_put = {**WALKTHROUGH_POSITION, "legs": [
        {"kind": "put", "strike": 500, "expiry_days": 30, "quantity": 1}
    ]}
    r = client.post("/position/payoff", json={
        "position": long_put,
        "spot_min": 460,
        "spot_max": 540,
        "num_points": 81,
    })
    body = r.json()
    pts = {round(p["spot"]): p for p in body["points"]}
    initial = body["initial_value"]
    # Above strike: P&L = -premium (constant)
    assert pts[510]["pnl_at_expiry"] == pytest.approx(-initial, abs=1.0)
    assert pts[520]["pnl_at_expiry"] == pytest.approx(-initial, abs=1.0)
    # Below strike: linear slope -100 per $1 of spot
    assert pts[500]["pnl_at_expiry"] - pts[490]["pnl_at_expiry"] == pytest.approx(-1000.0, abs=1.0)
    assert pts[490]["pnl_at_expiry"] - pts[480]["pnl_at_expiry"] == pytest.approx(-1000.0, abs=1.0)


def test_D12_initial_value_matches_sum_of_legs(client):
    """Multi-leg position: initial_value = Σ qty × leg-price × 100."""
    # Use a bull call spread so it's multi-leg and signed
    spread = {**WALKTHROUGH_POSITION, "legs": [
        {"kind": "call", "strike": 500, "expiry_days": 30, "quantity": 1},
        {"kind": "call", "strike": 510, "expiry_days": 30, "quantity": -1},
    ]}
    payoff_r = client.post("/position/payoff", json={"position": spread, "num_points": 21})
    initial = payoff_r.json()["initial_value"]
    # Cross-check: price each leg individually and sum, scaled ×100
    greeks_r1 = client.post("/position/greeks", json={
        **WALKTHROUGH_POSITION,
        "legs": [{"kind": "call", "strike": 500, "expiry_days": 30, "quantity": 1}],
    })
    greeks_r2 = client.post("/position/greeks", json={
        **WALKTHROUGH_POSITION,
        "legs": [{"kind": "call", "strike": 510, "expiry_days": 30, "quantity": -1}],
    })
    sum_legs = greeks_r1.json()["price"] + greeks_r2.json()["price"]
    assert initial == pytest.approx(sum_legs, abs=0.05)


# === F12, F13 — CORS preflight ===

def test_F12_cors_preflight_allowed_origin(client):
    """An origin in CORS_ORIGINS gets back Access-Control-Allow-Origin echoing it."""
    r = client.options("/position/greeks", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    # Starlette's CORSMiddleware returns 200 with the headers set on allowed preflight
    assert r.status_code in (200, 204)
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_F13_cors_preflight_blocked_origin(client):
    """An origin NOT in CORS_ORIGINS does not receive an Allow-Origin header echo."""
    r = client.options("/position/greeks", headers={
        "Origin": "https://malicious.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    # Per Starlette: blocked origins get either 400 OR no Allow-Origin header.
    # Either is a valid "not allowed" signal — assert the header is absent or doesn't match.
    allow = r.headers.get("access-control-allow-origin")
    assert allow != "https://malicious.example.com"
