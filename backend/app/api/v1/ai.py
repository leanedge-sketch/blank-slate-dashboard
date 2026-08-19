"""Central AI orchestration HTTP surface."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.ai_config import gemini_chat_model, openai_chat_model
from app.dependencies import get_current_user
from app.models.ai import AIGenerateRequest, AIGenerateResponse, AIGuardrailsStatus
from app.services.ai_service import AIServiceError, get_ai_service

router = APIRouter()


@router.get("/status", response_model=AIGuardrailsStatus)
async def ai_guardrails_status(_user: dict = Depends(get_current_user)):
    service = get_ai_service()
    flags = await service.read_guardrails()
    return AIGuardrailsStatus(
        emergency_ai_killswitch=flags["emergency_ai_killswitch"],
        enable_ai_summaries=flags["enable_ai_summaries"],
        enable_ai_icp=flags["enable_ai_icp"],
        monthly_budget_cap_usd=flags["monthly_budget_cap_usd"],
        current_month_spend_usd=flags["current_month_spend_usd"],
        tables_available=flags["tables_available"],
        gemini_model=gemini_chat_model(),
        openai_model=openai_chat_model(),
    )


@router.post("/generate", response_model=AIGenerateResponse)
async def ai_generate(
    body: AIGenerateRequest,
    _user: dict = Depends(get_current_user),
):
    service = get_ai_service()
    try:
        result = await service.generate_text(
            prompt=body.prompt,
            system_instruction=body.system_instruction,
            task_type=body.task_type,
            timeout_seconds=body.timeout_seconds,
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AIGenerateResponse(**result)
