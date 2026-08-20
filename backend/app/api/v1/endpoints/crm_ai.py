"""SSE endpoint for streaming ICP generation."""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.dependencies import get_current_user
from app.services.crm_ai_service import stream_icp_generation
from app.services.crm_service import get_customer_by_id

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/customers/{customer_id}/generate-icp-stream")
async def generate_icp_stream(
    customer_id: str,
    request: Request,
    quick: bool = Query(False, description="Skip external web/LinkedIn research"),
    _user: dict = Depends(get_current_user),
):
    customer = get_customer_by_id(customer_id)
    if not customer:
        async def missing():
            yield {
                "event": "error",
                "data": json.dumps({"message": "Customer not found"}),
            }

        return EventSourceResponse(missing())

    async def event_publisher():
        try:
            async for chunk in stream_icp_generation(
                customer_id,
                skip_external_research=quick,
                user_id=str(_user.get("id") or "") or None,
            ):
                if await request.is_disconnected():
                    logger.info("ICP SSE client disconnected for %s", customer_id)
                    break
                yield {
                    "event": "chunk",
                    "data": json.dumps({"t": chunk}),
                }
            if not await request.is_disconnected():
                yield {"event": "done", "data": json.dumps({"ok": True})}
        except asyncio.CancelledError:
            logger.info("ICP SSE cancelled for %s", customer_id)
            return
        except Exception as exc:
            logger.exception("ICP SSE failed for %s", customer_id)
            if not await request.is_disconnected():
                yield {
                    "event": "error",
                    "data": json.dumps({"message": str(exc)}),
                }

    return EventSourceResponse(event_publisher(), ping=15)

