"""
Vercel serverless entry for the FastAPI app.

The real ASGI application is built in backend/app/main.py (variable `app`).
This file only adjusts sys.path so that package imports match local `uvicorn` runs
from the `backend/` directory.

Requires Vercel **Root Directory** = repository root (not `frontend`).
Routes: /api/v1/*, /api/docs, etc.
"""
from __future__ import annotations

import sys
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(_backend_dir))

from app.main import app  # noqa: E402

__all__ = ["app"]
