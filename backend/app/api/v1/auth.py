"""
Authentication API Routes
=========================

HTTP endpoints for authentication and employee management:
- POST /api/v1/auth/check-employee  → Check if email exists in employees table
- GET  /api/v1/auth/me              → Get current user's employee info
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from supabase import Client
from app.database.connection import (
    get_supabase_client,
    get_supabase_service_client,
)
from app.dependencies import get_current_user
from app.config import settings
from app.services.email_service import EmailNotConfiguredError
from app.services.password_change_service import (
    change_password_with_current,
    confirm_password_change,
    request_password_change_verification,
)

router = APIRouter()


class PasswordChangeBody(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeConfirmBody(BaseModel):
    verification_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)


def _employee_display_name(supabase: Client, email: str | None) -> str | None:
    if not email:
        return None
    try:
        row = (
            supabase.table("employees")
            .select("name")
            .eq("email", str(email).lower().strip())
            .execute()
        )
        if row.data:
            return row.data[0].get("name")
    except Exception:
        pass
    return None


@router.get("/health/openai")
async def openai_health():
    """Smoke-test OpenAI key configured on this deployment (Vercel)."""
    from app.services.ai_service import CHAT_MODEL, _api_key, _get_client, reset_openai_client

    key = _api_key()
    if not key:
        return {"ok": False, "detail": "OPENAI_API_KEY is not set on the server."}
    if len(key) < 20:
        return {
            "ok": False,
            "detail": "OPENAI_API_KEY looks truncated. Paste the full sk-proj-… key on Vercel.",
        }
    try:
        reset_openai_client()
        client = _get_client()
        client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[{"role": "user", "content": "ok"}],
            max_tokens=2,
        )
        return {"ok": True, "model": CHAT_MODEL, "key_suffix": key[-4:]}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)[:300]}


@router.get("/auth/public-config")
async def public_supabase_config():
    """
    Public Supabase URL + anon key for the browser client.
    The anon key is intended for client-side use; this avoids relying on
    VITE_* vars being present at frontend build time on Vercel.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Server Supabase env missing: set SUPABASE_URL and SUPABASE_KEY on Vercel.",
        )
    return {"url": settings.SUPABASE_URL, "anon_key": settings.SUPABASE_KEY}


@router.get("/auth/check-employee")
async def check_employee_status(
    email: str = Query(..., description="Email address to check"),
    supabase: Client = Depends(get_supabase_service_client)  # Use service client for full access
):
    """
    Check if an email exists in the employees table.
    This endpoint uses the service role key to bypass RLS.
    """
    try:
        # Query employees table using service client (bypasses RLS)
        lookup = email.lower().strip()
        result = supabase.table("employees").select("email, role, name").eq("email", lookup).execute()
        print(f"[check-employee] lookup={lookup!r} result.data={result.data!r}")

        if result.data and len(result.data) > 0:
            employee = result.data[0]
            return {
                "is_employee": True,
                "email": employee["email"],
                "role": employee["role"],
                "name": employee.get("name"),
            }
        else:
            return {
                "is_employee": False,
                "email": email,
                "role": None,
                "name": None,
            }
    except Exception as e:
        print(f"Error checking employee status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check employee status: {str(e)}"
        )


@router.get("/auth/me")
async def get_current_employee_info(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client)
):
    """
    Get current authenticated user's employee information.
    """
    try:
        email = user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="User email not found")
        
        email_lower = email.lower().strip()
        result = supabase.table("employees").select("email, role, name").eq("email", email_lower).execute()
        
        # Debug logging for local development
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Checking employee status for email: {email_lower}")
        logger.info(f"Supabase URL: {supabase.url if hasattr(supabase, 'url') else 'N/A'}")
        logger.info(f"Query result: {result.data if result.data else 'No data'}")
        
        if result.data and len(result.data) > 0:
            employee = result.data[0]
            return {
                "is_employee": True,
                "email": employee["email"],
                "role": employee["role"],
                "name": employee.get("name"),
                "user_id": user.get("id"),
            }
        else:
            # More helpful error message
            raise HTTPException(
                status_code=403,
                detail=f"Your email ({email_lower}) is not registered as an employee. Please contact an administrator to add you to the employees table."
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting employee info: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get employee information: {str(e)}"
        )


@router.post("/auth/change-password")
async def change_password(
    body: PasswordChangeBody,
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client),
    anon_supabase: Client = Depends(get_supabase_client),
):
    """
    Change password in one step: verify current password, apply new password,
    and send a confirmation email when email is configured.
    """
    email = user.get("email") if isinstance(user, dict) else getattr(user, "email", None)
    display_name = _employee_display_name(supabase, email)

    try:
        return change_password_with_current(
            supabase=supabase,
            anon_supabase=anon_supabase,
            user=user,
            current_password=body.current_password,
            new_password=body.new_password,
            display_name=display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/auth/change-password/request")
async def request_change_password_code(
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client),
):
    """
    Legacy: send a 6-digit verification code (prefer POST /auth/change-password).
    """
    email = user.get("email") if isinstance(user, dict) else getattr(user, "email", None)
    display_name = _employee_display_name(supabase, email)

    try:
        return request_password_change_verification(
            supabase=supabase,
            user=user,
            display_name=display_name,
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/auth/change-password/confirm")
async def confirm_change_password(
    body: PasswordChangeConfirmBody,
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client),
):
    """
    Verify the emailed code and set the new password.
    """
    email = user.get("email") if isinstance(user, dict) else getattr(user, "email", None)
    display_name = _employee_display_name(supabase, email)

    try:
        return confirm_password_change(
            supabase=supabase,
            user=user,
            verification_code=body.verification_code,
            new_password=body.new_password,
            display_name=display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

