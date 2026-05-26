"""
Chat endpoint backed by Claude with tool use.

The model receives:
  - A system prompt that frames it as an options-education assistant
  - The user's CURRENT position state (legs + computed Greeks) appended to the
    system prompt as fresh context every turn
  - The full message history (frontend tracks it; we replay it each call)
  - Two tools it can invoke when it needs precise numbers:
      simulate_scenario(dS, dSigma_volpoints, dDays)
      recompute_greeks()

Tools call directly into the math engine — no HTTP recursion.
"""
from __future__ import annotations

import json
import os
import time
from collections import defaultdict
from typing import Any

import anthropic

from .math_engine import Position, simulate

MODEL = "claude-sonnet-4-5"
MAX_TOKENS = 2048
MAX_TOOL_ITERATIONS = 8  # safety cap on the tool-use loop


# === System prompt ===

SYSTEM_PROMPT = """\
You are an options education assistant inside "Options Greeks Playground", a teaching tool for retail options traders.

You are looking at the user's specific options position. Each message includes their current position state and the recent conversation.

YOUR ROLE
- Explain Greeks in plain English using THIS user's actual numbers
- Run scenarios when asked using the simulate_scenario tool — never guess numbers
- Suggest position adjustments and walk through the trade-offs as a learning exercise
- Always frame as education, not as buy/sell instructions

CONSTRAINTS
- Never give specific buy/sell recommendations, price targets, or "you should do X"
- When the user asks "what if X", call the simulate_scenario tool — quote real numbers, not estimates
- Cite specific Greek values when explaining ("your delta of 54 means…")
- Be concise — 2-4 sentences for simple questions, longer only when a multi-step explanation actually helps
- Prefer plain English over jargon when both work. The user is learning.

TOOLS
- simulate_scenario(dS, dSigma_volpoints, dDays):
    Run a what-if shock on the current position.
    dS = change in spot price in dollars (e.g. -10 for SPY drops $10).
    dSigma_volpoints = change in IV in vol-points (e.g. -5 means IV drops 5 percentage points).
    dDays = calendar days forward (e.g. 5 for "five days from now").
    Returns: actual P&L, plus Δ/Γ/Θ/Vega contributions in dollars, plus before/after Greeks.

- recompute_greeks():
    Recompute aggregated Greeks for the current position. Useful only if you want them fresh during a multi-step answer; the current Greeks are already in your context.

SAFETY
This is an educational tool. You don't know the user's portfolio, risk tolerance, or financial situation. Don't tell them what trade to put on. You CAN: explain trade-offs, simulate hypothetical adjustments to learn from them, and translate Greeks into dollar terms.

Educational only. Not trading advice.
"""


# === Tool schemas (Anthropic tool-use format) ===

TOOLS: list[dict[str, Any]] = [
    {
        "name": "simulate_scenario",
        "description": (
            "Run a what-if scenario on the user's current options position. "
            "Returns actual P&L and Δ/Γ/Θ/Vega decomposition in dollars, "
            "plus the Greeks before and after the shock. Use this whenever "
            "you need exact numbers — do not estimate."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dS": {
                    "type": "number",
                    "description": (
                        "Change in spot price in dollars. Positive = spot rises, "
                        "negative = spot falls. E.g. -10 means SPY drops $10."
                    ),
                },
                "dSigma_volpoints": {
                    "type": "number",
                    "description": (
                        "Change in implied volatility, in vol-points (percentage points). "
                        "E.g. -5 means IV drops 5 percentage points (20% → 15%)."
                    ),
                },
                "dDays": {
                    "type": "integer",
                    "description": (
                        "Calendar days forward (0 = today). Cannot exceed the position's "
                        "minimum expiry minus 1."
                    ),
                    "minimum": 0,
                },
            },
            "required": ["dS", "dSigma_volpoints", "dDays"],
        },
    },
    {
        "name": "recompute_greeks",
        "description": (
            "Recompute aggregated Greeks for the current position. The current Greeks "
            "are already provided in your system context — only call this if you "
            "specifically need them recomputed mid-answer."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
]


# === Tool execution ===

def _run_tool(name: str, tool_input: dict[str, Any], position: Position) -> dict[str, Any]:
    """Dispatch a tool_use block to the math engine."""
    if name == "simulate_scenario":
        # Convert vol-points → decimal sigma
        dSigma = float(tool_input["dSigma_volpoints"]) / 100.0
        result = simulate(
            position=position,
            dS=float(tool_input["dS"]),
            dSigma=dSigma,
            dDays=int(tool_input["dDays"]),
        )
        return {
            "actual_pnl": round(result.actual_pnl, 2),
            "delta_contribution": round(result.delta_contribution, 2),
            "gamma_contribution": round(result.gamma_contribution, 2),
            "theta_contribution": round(result.theta_contribution, 2),
            "vega_contribution": round(result.vega_contribution, 2),
            "sum_of_components": round(result.sum_of_components, 2),
            "residual": round(result.residual, 2),
            "initial_greeks": {
                "delta": round(result.initial_greeks.delta, 2),
                "gamma": round(result.initial_greeks.gamma, 4),
                "theta_per_day": round(result.initial_greeks.theta_per_day, 2),
                "vega_per_volpoint": round(result.initial_greeks.vega_per_volpoint, 2),
            },
            "new_greeks": {
                "delta": round(result.new_greeks.delta, 2),
                "gamma": round(result.new_greeks.gamma, 4),
                "theta_per_day": round(result.new_greeks.theta_per_day, 2),
                "vega_per_volpoint": round(result.new_greeks.vega_per_volpoint, 2),
            },
        }
    if name == "recompute_greeks":
        g = position.greeks()
        return {
            "price": round(g.price, 2),
            "delta": round(g.delta, 2),
            "gamma": round(g.gamma, 4),
            "theta_per_day": round(g.theta_per_day, 2),
            "vega_per_volpoint": round(g.vega_per_volpoint, 2),
            "rho_per_pct": round(g.rho_per_pct, 2),
        }
    raise ValueError(f"unknown tool: {name}")


# === Position → system-prompt context ===

def _format_position_context(position: Position) -> str:
    """Render the current position + Greeks as a chunk Claude can read."""
    g = position.greeks()
    legs_lines = []
    for i, leg in enumerate(position.legs, 1):
        side = "Long" if leg.quantity > 0 else "Short"
        qty = abs(leg.quantity)
        legs_lines.append(
            f"  {i}. {side} {qty} {leg.kind} @ strike ${leg.strike:.0f}, expiry in {leg.expiry_days} days"
        )
    legs_block = "\n".join(legs_lines) if legs_lines else "  (no legs)"
    return (
        "\n\n=== CURRENT POSITION ===\n"
        f"- Underlying spot: ${position.S:.2f}\n"
        f"- Implied volatility: {position.sigma * 100:.1f}%\n"
        f"- Risk-free rate: {position.r * 100:.1f}%\n"
        f"- Legs ({len(position.legs)} total):\n"
        f"{legs_block}\n\n"
        "=== AGGREGATED GREEKS (per contract; multiplier = 100 shares) ===\n"
        f"- Position value: ${g.price:.2f}\n"
        f"- Delta: {g.delta:.2f}   (P&L change per $1 spot move)\n"
        f"- Gamma: {g.gamma:.4f}   (delta change per $1 spot move)\n"
        f"- Theta: ${g.theta_per_day:.2f}/day   (time decay)\n"
        f"- Vega: ${g.vega_per_volpoint:.2f}/vol-pt   (IV sensitivity)\n"
        f"- Rho: ${g.rho_per_pct:.2f}/1% rate\n"
    )


# === Rate limiter (in-memory, per-IP, hour window) ===

_RATE_LIMIT_PER_HOUR = 20
_rate_buckets: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(ip: str) -> tuple[bool, int]:
    """Return (allowed, used_count). Drops timestamps older than 1 hour."""
    now = time.time()
    cutoff = now - 3600
    bucket = _rate_buckets[ip]
    bucket[:] = [t for t in bucket if t > cutoff]
    if len(bucket) >= _RATE_LIMIT_PER_HOUR:
        return False, len(bucket)
    bucket.append(now)
    return True, len(bucket)


# === Main chat entrypoint ===

def chat(
    messages: list[dict[str, str]],
    position: Position,
) -> dict[str, Any]:
    """
    Run a single chat round-trip with tool use.

    `messages` is the conversation history in {"role": "user"|"assistant", "content": str} form.
    Returns {"content": <final text>, "tool_uses": [<tool call log>]}
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)

    # Build the system prompt with fresh position context
    system = SYSTEM_PROMPT + _format_position_context(position)

    # Convert frontend history to Anthropic format
    api_messages: list[dict[str, Any]] = [
        {"role": m["role"], "content": m["content"]} for m in messages
    ]

    tool_uses_log: list[dict[str, Any]] = []

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            tools=TOOLS,
            messages=api_messages,
        )

        if response.stop_reason == "end_turn":
            # Concatenate text blocks for the final answer
            text = "\n".join(
                b.text for b in response.content if getattr(b, "type", None) == "text"
            )
            return {"content": text.strip(), "tool_uses": tool_uses_log}

        if response.stop_reason == "tool_use":
            # Replay the assistant turn (with both text + tool_use blocks)
            api_messages.append({"role": "assistant", "content": response.content})

            # Execute each tool_use block, accumulate results
            tool_results = []
            for block in response.content:
                if getattr(block, "type", None) != "tool_use":
                    continue
                try:
                    output = _run_tool(block.name, block.input, position)
                    tool_uses_log.append({
                        "name": block.name,
                        "input": block.input,
                        "output": output,
                    })
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(output),
                    })
                except Exception as e:  # noqa: BLE001
                    tool_uses_log.append({
                        "name": block.name,
                        "input": block.input,
                        "error": str(e),
                    })
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "is_error": True,
                        "content": f"Tool error: {e}",
                    })
            api_messages.append({"role": "user", "content": tool_results})
            continue  # loop and let Claude finish

        # Unexpected stop reason (max_tokens, etc.)
        text = "\n".join(
            b.text for b in response.content if getattr(b, "type", None) == "text"
        )
        return {
            "content": text.strip() or f"(model stopped: {response.stop_reason})",
            "tool_uses": tool_uses_log,
        }

    return {
        "content": "(reached tool-iteration limit — try rephrasing)",
        "tool_uses": tool_uses_log,
    }
