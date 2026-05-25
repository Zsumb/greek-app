"""FastAPI entry point for the Greeks Education API."""
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
