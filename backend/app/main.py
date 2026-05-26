"""FastAPI entry point for the Greeks Education API."""
import os

from dotenv import load_dotenv
# Load backend/.env for local dev. override=True so a local .env beats any
# stale/empty env var the shell may have inherited. In Railway/production
# there's no .env file so this is a no-op — env vars come from the platform.
load_dotenv(override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

app = FastAPI(
    title="Greeks Education API",
    description=(
        "Black-Scholes pricing, multi-leg Greeks aggregation, and "
        "P&L decomposition for options education. See /docs for interactive Swagger UI."
    ),
    version="0.1.0",
)

# CORS: comma-separated list in the CORS_ORIGINS env var. Defaults to local
# dev URLs so `uvicorn --reload` works out of the box. In production
# (Railway / Fly / etc.) set CORS_ORIGINS to your frontend's URL — e.g.
# CORS_ORIGINS=https://greek-app.vercel.app
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
allowed_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _default_origins).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", summary="Service identity")
def root() -> dict:
    return {
        "name": "Greeks Education API",
        "version": "0.1.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }
