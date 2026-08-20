"""GET /api/v1/home/at-a-glance — cache read only (never calls Gemini/OpenAI)."""

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.services.home_summary_service import (
    live_sql_payload,
    read_unexpired_home_summary,
)

router = APIRouter()


@router.get("/at-a-glance")
async def get_at_a_glance(_user: dict = Depends(get_current_user)):
    cached = read_unexpired_home_summary()
    if cached:
        return cached
    return live_sql_payload()
