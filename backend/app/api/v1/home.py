"""Compatibility shim — canonical router lives in endpoints.home_summary."""

from app.api.v1.endpoints.home_summary import router  # noqa: F401
