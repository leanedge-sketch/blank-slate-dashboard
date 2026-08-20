"""Public AI support for failed logins — outside the authentication critical path."""

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_service import AIServiceError, get_ai_service

LOGIN_SUPPORT_SYSTEM = (
    "You are LeanChem's IT support assistant. The user is struggling to log in. "
    "Guide them to check their corporate email, or instruct them to contact IT admin "
    "Mohammed Sani if their employee profile is missing. Keep it under 3 sentences."
)

router = APIRouter()


class DiagnoseLoginRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    fail_context: Literal[
        "invalid_credentials",
        "employee_missing",
        "expired_link",
        "network",
    ] = "invalid_credentials"
    email: Optional[str] = Field(default=None, max_length=320)


class DiagnoseLoginResponse(BaseModel):
    content: str
    provider_used: str
    is_fallback: bool


@router.post("/diagnose-login", response_model=DiagnoseLoginResponse)
async def diagnose_login(body: DiagnoseLoginRequest):
    """Natural-language IT help after deterministic auth already failed. No password/token checks."""
    context_line = f"Failed login context: {body.fail_context}."
    if body.email:
        context_line += " The user entered a corporate email address (do not repeat or validate it)."
    prompt = f"{context_line}\n\nUser message:\n{body.message.strip()}"

    service = get_ai_service()
    try:
        result = await service.generate_text(
            prompt=prompt,
            system_instruction=LOGIN_SUPPORT_SYSTEM,
            task_type="login_support",
            timeout_seconds=8.0,
            max_tokens=220,
        )
    except AIServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return DiagnoseLoginResponse(
        content=result["content"],
        provider_used=result["provider_used"],
        is_fallback=bool(result["is_fallback"]),
    )
