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
    get_supabase_admin_client,
    get_supabase_service_client,
)
from app.dependencies import get_current_user
from app.config import settings
from app.services.email_service import EmailNotConfiguredError
from app.services.password_change_service import (
    change_password_with_current,
    confirm_password_change,
    request_password_change_verification,
    request_password_change_with_current,
)

router = APIRouter()

VALID_EMPLOYEE_ROLES = {
    "admin",
    "product manager",
    "sales and stock",
    "sales",
    "logistic",
}


def _normalize_email(email: str | None) -> str:
    return (email or "").lower().strip()


def _normalize_role(role: str | None) -> str | None:
    if not role:
        return None
    cleaned = str(role).strip().lower()
    if cleaned in VALID_EMPLOYEE_ROLES:
        return cleaned
    # Common aliases from Supabase metadata / admin UI
    aliases = {
        "product_manager": "product manager",
        "sales_and_stock": "sales and stock",
        "logistics": "logistic",
        "logistics_manager": "logistic",
    }
    return aliases.get(cleaned.replace(" ", "_"))


def _role_from_auth_metadata(user: dict) -> tuple[str | None, str | None]:
    """Read role/name hints from Supabase Auth user metadata."""
    user_meta = user.get("user_metadata") or {}
    app_meta = user.get("app_metadata") or {}
    if not isinstance(user_meta, dict):
        user_meta = {}
    if not isinstance(app_meta, dict):
        app_meta = {}

    role = _normalize_role(
        user_meta.get("role")
        or app_meta.get("role")
        or user_meta.get("employee_role")
        or app_meta.get("employee_role")
    )
    name = (
        user_meta.get("full_name")
        or user_meta.get("name")
        or app_meta.get("name")
        or app_meta.get("full_name")
    )
    if isinstance(name, str):
        name = name.strip() or None
    else:
        name = None

    is_employee = (
        user_meta.get("is_employee")
        or app_meta.get("is_employee")
        or user_meta.get("employee")
        or app_meta.get("employee")
    )
    if not role and is_employee in (True, "true", "1", 1):
        role = "sales"
    return role, name


def _upsert_employee_row(
    supabase: Client,
    email: str,
    role: str,
    name: str | None = None,
) -> dict | None:
    payload: dict = {"email": email, "role": role}
    if name:
        payload["name"] = name
    try:
        supabase.table("employees").upsert(payload, on_conflict="email").execute()
    except Exception as exc:
        print(f"[employees] upsert failed for {email!r}: {exc}")
    return _find_employee_row(supabase, email) or payload


def _provision_employee_for_auth_user(
    supabase: Client,
    user: dict,
) -> dict | None:
    """
    Ensure an employees row exists for a signed-in Supabase Auth user.
    Uses metadata role when present; otherwise defaults to sales when auto-provision is on.
    """
    email = _normalize_email(user.get("email"))
    if not email:
        return None

    existing = _find_employee_row(supabase, email)
    if existing:
        return existing

    meta_role, meta_name = _role_from_auth_metadata(user)
    role = meta_role
    if not role and settings.EMPLOYEE_AUTO_PROVISION_AUTH_USERS:
        role = "sales"
    if not role:
        return None

    print(f"[employees] provisioning {email!r} with role={role!r}")
    row = _upsert_employee_row(supabase, email, role, meta_name)
    if row:
        return row
    # Table missing or upsert blocked — still grant session access in-memory.
    return {"email": email, "role": role, "name": meta_name}


def _find_employee_row(supabase: Client, email: str) -> dict | None:
    """Match employees by normalized email (case/whitespace tolerant)."""
    lookup = _normalize_email(email)
    if not lookup:
        return None

    # Exact match first (fast path when emails are stored lowercase).
    exact = (
        supabase.table("employees")
        .select("email, role, name")
        .eq("email", lookup)
        .limit(1)
        .execute()
    )
    if exact.data:
        return exact.data[0]

    # Case-insensitive fallback for legacy rows.
    loose = (
        supabase.table("employees")
        .select("email, role, name")
        .ilike("email", lookup)
        .limit(20)
        .execute()
    )
    for row in loose.data or []:
        if _normalize_email(row.get("email")) == lookup:
            return row
    return None


def _employee_check_payload(employee: dict | None, email: str) -> dict:
    if employee:
        return {
            "is_employee": True,
            "email": employee["email"],
            "role": employee.get("role"),
            "name": employee.get("name"),
        }
    return {
        "is_employee": False,
        "email": email,
        "role": None,
        "name": None,
    }


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
    supabase: Client = Depends(get_supabase_admin_client),
):
    """
    Check if an email exists in the employees table.
    Uses service role when configured; otherwise anon (may return not found if RLS blocks).
    """
    try:
        lookup = _normalize_email(email)
        employee = _find_employee_row(supabase, lookup)
        print(f"[check-employee] lookup={lookup!r} found={employee is not None}")
        return _employee_check_payload(employee, lookup or email)
    except Exception as e:
        print(f"Error checking employee status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check employee status: {str(e)}"
        )


@router.get("/auth/verify-employee")
async def verify_employee_for_session(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_admin_client),
):
    """
    Verify the signed-in user's email against the employees table.
    Preferred after login when the public check-employee call returns false.
    """
    email = _normalize_email(user.get("email"))
    if not email:
        raise HTTPException(status_code=400, detail="User email not found in session")
    employee = _provision_employee_for_auth_user(supabase, user)
    if not employee:
        employee = _find_employee_row(supabase, email)
    return _employee_check_payload(employee, email)


@router.get("/auth/me")
async def get_current_employee_info(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_admin_client)
):
    """
    Get current authenticated user's employee information.
    """
    try:
        email = user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="User email not found")
        
        email_lower = _normalize_email(email)
        employee = _provision_employee_for_auth_user(supabase, user)
        if not employee:
            employee = _find_employee_row(supabase, email_lower)
        
        # Debug logging for local development
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Checking employee status for email: {email_lower}")
        logger.info(f"Supabase URL: {supabase.url if hasattr(supabase, 'url') else 'N/A'}")
        logger.info(f"Employee found: {employee is not None}")
        
        if employee:
            return {
                "is_employee": True,
                "email": employee["email"],
                "role": employee.get("role"),
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


@router.post("/auth/change-password/start")
async def start_change_password(
    body: PasswordChangeBody,
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client),
    anon_supabase: Client = Depends(get_supabase_client),
):
    """
    Verify current password and email a 6-digit code to the signed-in user.
    Complete with POST /auth/change-password/confirm.
    """
    email = user.get("email") if isinstance(user, dict) else getattr(user, "email", None)
    display_name = _employee_display_name(supabase, email)

    try:
        return request_password_change_with_current(
            supabase=supabase,
            anon_supabase=anon_supabase,
            user=user,
            current_password=body.current_password,
            new_password=body.new_password,
            display_name=display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/auth/change-password/request")
async def request_change_password_code(
    user=Depends(get_current_user),
    supabase: Client = Depends(get_supabase_service_client),
):
    """
    Legacy: send a 6-digit verification code without verifying current password.
    Prefer POST /auth/change-password/start.
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

