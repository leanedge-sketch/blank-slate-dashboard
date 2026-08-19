from typing import Optional

from pydantic import BaseModel, Field


class AIGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    system_instruction: str = ""
    task_type: str = "general"
    timeout_seconds: float = 4.0


class AIGenerateResponse(BaseModel):
    content: str
    provider_used: str
    is_fallback: bool


class AIGuardrailsStatus(BaseModel):
    emergency_ai_killswitch: bool
    enable_ai_summaries: bool
    enable_ai_icp: bool
    monthly_budget_cap_usd: float
    current_month_spend_usd: float
    tables_available: bool
    primary_provider: str = "gemini"
    fallback_provider: str = "openai"
    gemini_model: Optional[str] = None
    openai_model: Optional[str] = None
