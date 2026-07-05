"""Pydantic request/response schemas for the API."""
from typing import Literal, List, Optional
from pydantic import BaseModel, Field, model_validator


# === Inputs ===

class LegIn(BaseModel):
    kind: Literal["call", "put", "stock"]
    strike: float = Field(default=0.0, ge=0, description="ignored for stock legs")
    expiry_days: int = Field(default=0, ge=0,
                             description="calendar days from position-open; ignored for stock legs")
    quantity: int = Field(description="contracts (1 = 100 shares); negative = short")
    sigma: Optional[float] = Field(default=None, gt=0, lt=5,
                                   description="per-leg IV override in decimal (0.22 = 22%); "
                                               "falls back to position sigma")
    entry_price: Optional[float] = Field(default=None, ge=0,
                                         description="actual fill per share; affects cost basis only. "
                                                     "Defaults to model price.")

    @model_validator(mode="after")
    def _option_legs_need_strike_and_expiry(self):
        if self.kind != "stock":
            if self.strike <= 0:
                raise ValueError("strike must be > 0 for option legs")
            if self.expiry_days <= 0:
                raise ValueError("expiry_days must be > 0 for option legs")
        return self


class PositionIn(BaseModel):
    S: float = Field(gt=0, description="spot price at position creation")
    sigma: float = Field(gt=0, lt=5, description="IV in decimal (0.20 = 20%)")
    r: float = Field(ge=0, lt=1, description="risk-free rate in decimal")
    legs: List[LegIn] = Field(min_length=1)


class PayoffRequest(BaseModel):
    position: PositionIn
    spot_min: Optional[float] = Field(default=None, description="defaults to S * 0.9")
    spot_max: Optional[float] = Field(default=None, description="defaults to S * 1.1")
    num_points: int = Field(default=201, gt=10, le=1001)


class SimulateRequest(BaseModel):
    position: PositionIn
    dS: float = Field(default=0.0, description="change in spot ($)")
    dSigma: float = Field(default=0.0, description="change in IV decimal (-0.01 = -1 vol-pt)")
    dDays: int = Field(default=0, ge=0)


# === Outputs ===

class GreeksOut(BaseModel):
    price: float
    delta: float
    gamma: float
    theta_per_day: float
    vega_per_volpoint: float
    rho_per_pct: float


class PayoffPoint(BaseModel):
    spot: float
    pnl_today: float
    pnl_at_expiry: float


class PayoffOut(BaseModel):
    initial_value: float  # mark-to-model value at position open
    cost_basis: float     # entry-price-based basis (equals initial_value when no overrides)
    points: List[PayoffPoint]


class LegPricesOut(BaseModel):
    """Per-share Black-Scholes price for each leg, in the same order as input."""
    prices: List[float]


class SimulateOut(BaseModel):
    actual_pnl: float
    delta_contribution: float
    gamma_contribution: float
    theta_contribution: float
    vega_contribution: float
    sum_of_components: float
    residual: float
    initial_greeks: GreeksOut
    new_greeks: GreeksOut


# === Chain (yfinance) ===

class ChainMetaOut(BaseModel):
    ticker: str
    spot: float
    expiries: List[str]
    as_of: str


class ExpiryItem(BaseModel):
    date: str  # YYYY-MM-DD
    days_to_expiry: int


# === Chat (Claude-backed Q&A) ===

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)
    position: PositionIn


class ChatToolUse(BaseModel):
    name: str
    input: dict
    output: Optional[dict] = None
    error: Optional[str] = None


class ChatResponse(BaseModel):
    role: Literal["assistant"] = "assistant"
    content: str
    tool_uses: List[ChatToolUse] = Field(default_factory=list)
    rate_used: int  # how many messages this IP has used this hour


class TickerSnapshotOut(BaseModel):
    """One-call payload for the frontend: spot, available expiries (with DTE
    pre-computed), and the ATM-call implied vol for the nearest expiry."""
    ticker: str
    spot: float
    as_of: str
    expiries: List[ExpiryItem]
    atm_expiry: Optional[str] = None
    atm_strike: Optional[float] = None
    atm_iv: Optional[float] = None


class ChainRow(BaseModel):
    strike: float
    bid: float
    ask: float
    mid: float
    last: float
    volume: int
    open_interest: int
    iv: float


class ChainOut(BaseModel):
    ticker: str
    spot: float
    expiry: str
    as_of: str
    calls: List[ChainRow]
    puts: List[ChainRow]
