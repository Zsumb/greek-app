# Lightweight FastAPI container for Railway / Fly / any container host.
# Listens on $PORT (Railway sets this dynamically) with a default of 8000.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY app/ ./app/

EXPOSE 8000

# Use sh -c so $PORT expands at runtime (Railway provides it; default 8000 otherwise).
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
