"""
Chat endpoint tests.

Strategy:
  - Most tests mock `anthropic.Anthropic` so we exercise the tool-use loop,
    rate limit, and error paths for free (no Anthropic API spend).
  - One test (H_integration) hits the real API and is marked `network`.
  - Mocks build minimal fake response objects mimicking the parts of the
    Anthropic SDK response that `chat.chat()` actually reads.
"""
from __future__ import annotations

import json
import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app import chat as chat_module
from app.math_engine import Position, Leg, simulate


@pytest.fixture
def client():
    return TestClient(app)


WALKTHROUGH_POSITION_JSON = {
    "S": 500.0,
    "sigma": 0.20,
    "r": 0.05,
    "legs": [{"kind": "call", "strike": 500, "expiry_days": 30, "quantity": 1}],
}


def _make_text_block(text: str):
    """Mimic an Anthropic SDK text content block."""
    b = SimpleNamespace()
    b.type = "text"
    b.text = text
    return b


def _make_tool_use_block(tool_id: str, name: str, tool_input: dict):
    """Mimic an Anthropic SDK tool_use content block."""
    b = SimpleNamespace()
    b.type = "tool_use"
    b.id = tool_id
    b.name = name
    b.input = tool_input
    return b


def _make_response(stop_reason: str, content_blocks: list):
    """Mimic an Anthropic SDK Message response."""
    r = SimpleNamespace()
    r.stop_reason = stop_reason
    r.content = content_blocks
    return r


@pytest.fixture
def fake_anthropic_simple(monkeypatch):
    """
    Mock anthropic.Anthropic so chat() returns a single text reply.
    No tool use; one round-trip.
    """
    fake_client = MagicMock()
    fake_client.messages.create.return_value = _make_response(
        stop_reason="end_turn",
        content_blocks=[_make_text_block(
            "Your delta of 54 means each $1 SPY move adds $54 to your P&L."
        )],
    )
    monkeypatch.setattr(chat_module.anthropic, "Anthropic", lambda **_: fake_client)
    # Make sure API-key env var is set so chat() doesn't raise early
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-fake")
    return fake_client


@pytest.fixture
def fake_anthropic_with_tool(monkeypatch):
    """
    Mock anthropic.Anthropic to return one tool_use, then a final text.
    Models the two-round-trip pattern Claude uses for tool calls.
    """
    fake_client = MagicMock()
    fake_client.messages.create.side_effect = [
        # 1st: model wants to call simulate_scenario
        _make_response("tool_use", [
            _make_text_block("Let me run that scenario."),
            _make_tool_use_block(
                tool_id="toolu_xyz",
                name="simulate_scenario",
                tool_input={"dS": -15.0, "dSigma_volpoints": 0.0, "dDays": 3},
            ),
        ]),
        # 2nd: after receiving tool result, model answers
        _make_response("end_turn", [
            _make_text_block(
                "If SPY drops $15 over 3 days you'd lose roughly $890 — mostly delta."
            ),
        ]),
    ]
    monkeypatch.setattr(chat_module.anthropic, "Anthropic", lambda **_: fake_client)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-fake")
    return fake_client


@pytest.fixture
def reset_rate_limiter():
    """Clear the in-memory rate-limit buckets between tests so they don't bleed."""
    chat_module._rate_buckets.clear()
    yield
    chat_module._rate_buckets.clear()


# ===========================================================================
# === H1, H2, H3 — chat flows (mocked) ===
# ===========================================================================


def test_H1_simple_explanation_no_tools(client, fake_anthropic_simple, reset_rate_limiter):
    """User asks a definition; Claude replies with text only, no tool calls."""
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "What does delta mean?"}],
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 200
    body = r.json()
    assert "delta" in body["content"].lower()
    assert len(body["tool_uses"]) == 0
    assert body["rate_used"] == 1


def test_H2_triggers_simulate_scenario(client, fake_anthropic_with_tool, reset_rate_limiter):
    """A 'what if' question routes through the simulate_scenario tool."""
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "What if SPY drops 3% in 3 days?"}],
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["tool_uses"]) == 1
    tu = body["tool_uses"][0]
    assert tu["name"] == "simulate_scenario"
    # Output should carry the decomposition keys
    assert {"actual_pnl", "delta_contribution", "gamma_contribution",
            "theta_contribution", "vega_contribution"} <= set(tu["output"].keys())


def test_H3_multi_turn_history_replays(client, fake_anthropic_simple, reset_rate_limiter):
    """Multi-message history is passed through to Anthropic verbatim."""
    history = [
        {"role": "user", "content": "What does delta mean?"},
        {"role": "assistant", "content": "Delta is your P&L per $1 move in the underlying."},
        {"role": "user", "content": "And gamma?"},
    ]
    r = client.post("/chat", json={
        "messages": history,
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 200
    # Verify the mock was called with all 3 messages forwarded
    fake_anthropic_simple.messages.create.assert_called_once()
    kwargs = fake_anthropic_simple.messages.create.call_args.kwargs
    assert len(kwargs["messages"]) == 3
    assert kwargs["messages"][0]["content"] == "What does delta mean?"
    assert kwargs["messages"][2]["content"] == "And gamma?"


# ===========================================================================
# === H4, H5, H6 — error / limit paths ===
# ===========================================================================


def test_H4_rate_limit_returns_429(client, fake_anthropic_simple, reset_rate_limiter):
    """After 20 calls in an hour from the same IP, the 21st returns 429."""
    payload = {
        "messages": [{"role": "user", "content": "hello"}],
        "position": WALKTHROUGH_POSITION_JSON,
    }
    # Push the bucket to the limit (20 successful)
    for _ in range(chat_module._RATE_LIMIT_PER_HOUR):
        r = client.post("/chat", json=payload)
        assert r.status_code == 200
    # The next one should be blocked
    r = client.post("/chat", json=payload)
    assert r.status_code == 429
    assert "rate limit" in r.json()["detail"].lower()


def test_H5_missing_api_key_returns_503(client, monkeypatch, reset_rate_limiter):
    """If ANTHROPIC_API_KEY isn't set, /chat returns 503 with a clear message."""
    # Force missing key — note: load_dotenv() runs at import time, so we
    # actively delete the var.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "hello"}],
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 503
    assert "ANTHROPIC_API_KEY" in r.json()["detail"]


def test_H6_empty_messages_rejected(client, fake_anthropic_simple, reset_rate_limiter):
    """Schema requires at least 1 message; empty list is 422."""
    r = client.post("/chat", json={
        "messages": [],
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 422


# ===========================================================================
# === H7 — tool dispatch is wired to the real math engine ===
# ===========================================================================


def test_H7_simulate_tool_matches_engine():
    """
    Direct call to _run_tool("simulate_scenario", ...) should produce the same
    numbers as a direct simulate() call. Catches any drift in the dispatcher.
    """
    pos = Position(
        legs=[Leg(kind="call", strike=500, expiry_days=30, quantity=1)],
        S=500.0, sigma=0.20, r=0.05,
    )
    tool_out = chat_module._run_tool(
        "simulate_scenario",
        {"dS": 5.0, "dSigma_volpoints": -1.0, "dDays": 5},
        pos,
    )
    direct = simulate(pos, dS=5.0, dSigma=-0.01, dDays=5)
    assert tool_out["actual_pnl"] == pytest.approx(round(direct.actual_pnl, 2))
    assert tool_out["delta_contribution"] == pytest.approx(round(direct.delta_contribution, 2))
    assert tool_out["theta_contribution"] == pytest.approx(round(direct.theta_contribution, 2))


def test_H7b_recompute_greeks_tool_matches_engine():
    """The recompute_greeks tool should mirror position.greeks()."""
    pos = Position(
        legs=[Leg(kind="put", strike=500, expiry_days=30, quantity=-1)],
        S=510.0, sigma=0.25, r=0.04,
    )
    tool_out = chat_module._run_tool("recompute_greeks", {}, pos)
    direct = pos.greeks()
    assert tool_out["price"] == pytest.approx(round(direct.price, 2))
    assert tool_out["delta"] == pytest.approx(round(direct.delta, 2))


# ===========================================================================
# === H8 — system prompt safety guardrail ===
# ===========================================================================


def test_H8_system_prompt_forbids_recommendations():
    """
    The system prompt must explicitly forbid specific buy/sell recommendations.
    We assert on the prompt text directly rather than rely on the LLM behaving —
    this guards against accidental prompt regressions in code review.
    """
    sp = chat_module.SYSTEM_PROMPT.lower()
    assert "never give specific buy/sell" in sp or "never recommend" in sp.replace(",", "")
    assert "educational" in sp


# ===========================================================================
# === H9 — vol-points → decimal conversion at the tool boundary ===
# ===========================================================================


def test_H9_tool_converts_volpoints_to_decimal():
    """
    The simulate_scenario tool takes dSigma in vol-points (e.g. -1 means
    IV drops 1 percentage point); internally simulate() takes decimal
    (e.g. -0.01). Verify the conversion at the boundary.
    """
    pos = Position(
        legs=[Leg(kind="call", strike=500, expiry_days=30, quantity=1)],
        S=500.0, sigma=0.20, r=0.05,
    )
    # 1 vol-point should equal 0.01 decimal
    via_tool = chat_module._run_tool(
        "simulate_scenario",
        {"dS": 0.0, "dSigma_volpoints": -1.0, "dDays": 0},
        pos,
    )
    via_engine_decimal = simulate(pos, dS=0.0, dSigma=-0.01, dDays=0)
    assert via_tool["vega_contribution"] == pytest.approx(
        round(via_engine_decimal.vega_contribution, 2),
        abs=0.01,
    )


# ===========================================================================
# === Optional live integration test (Anthropic API costs money) ===
# ===========================================================================


@pytest.mark.network
def test_chat_live_integration(client, reset_rate_limiter):
    """
    Hits real Anthropic. Only runs with `pytest -m network` AND when
    ANTHROPIC_API_KEY is set. Validates the contract end-to-end.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "In one sentence, what does delta mean?"}],
        "position": WALKTHROUGH_POSITION_JSON,
    })
    assert r.status_code == 200
    body = r.json()
    assert len(body["content"]) > 0
    assert "delta" in body["content"].lower()
