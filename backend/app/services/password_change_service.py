"""
Password change with email verification code stored in Supabase user metadata.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from supabase import Client

from app.config import settings
from app.services.email_service import EmailNotConfiguredError, send_email

CODE_TTL_MINUTES = 15
META_CODE_HASH = "password_change_code_hash"
META_EXPIRES = "password_change_expires"


def _user_id(user: object) -> str:
    if isinstance(user, dict):
        uid = user.get("id")
    else:
        uid = getattr(user, "id", None)
    if not uid:
        raise ValueError("User id not found")
    return str(uid)


def _user_email(user: object) -> str:
    if isinstance(user, dict):
        email = user.get("email")
    else:
        email = getattr(user, "email", None)
    if not email:
        raise ValueError("User email not found")
    return str(email).lower().strip()


def _user_metadata(user: object) -> dict:
    if isinstance(user, dict):
        meta = user.get("user_metadata") or {}
    else:
        meta = getattr(user, "user_metadata", None) or {}
    return dict(meta) if meta else {}


def _hash_code(code: str) -> str:
    pepper = settings.JWT_SECRET or settings.SUPABASE_SERVICE_KEY or "leanchem"
    return hashlib.sha256(f"{pepper}:{code}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def _send_password_changed_notification(
    *,
    email: str,
    display_name: str | None = None,
) -> bool:
    """Send confirmation email after a successful password change. Returns True if sent."""
    name = display_name or email
    subject = "LeanChem Connect — your password was changed"
    html = f"""
    <p>Hello {name},</p>
    <p>This confirms that the password for your LeanChem Connect account (<strong>{email}</strong>) was changed successfully.</p>
    <p>If you did not make this change, contact your administrator immediately.</p>
    <p>— LeanChem Connect</p>
    """
    text = (
        f"Your LeanChem Connect password for {email} was changed. "
        "If this wasn't you, contact your administrator."
    )
    try:
        send_email(to=email, subject=subject, html=html, text=text)
        return True
    except EmailNotConfiguredError:
        return False
    except Exception:
        return False


def _apply_new_password(
    *,
    supabase: Client,
    user_id: str,
    new_password: str,
) -> None:
    meta = _fresh_user_metadata(supabase, user_id)
    cleaned_meta = {
        k: v
        for k, v in meta.items()
        if k not in (META_CODE_HASH, META_EXPIRES)
    }
    cleaned_meta["password_set"] = True
    cleaned_meta["password_set_at"] = datetime.now(timezone.utc).isoformat()

    supabase.auth.admin.update_user_by_id(
        user_id,
        {
            "password": new_password,
            "user_metadata": cleaned_meta,
        },
    )


def change_password_with_current(
    *,
    supabase: Client,
    anon_supabase: Client,
    user: object,
    current_password: str,
    new_password: str,
    display_name: str | None = None,
) -> dict:
    """
    Verify current password, update to new password, and email a confirmation (if configured).
    No verification code — current password is sufficient proof.
    """
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if current_password == new_password:
        raise ValueError("New password must be different from your current password.")

    user_id = _user_id(user)
    email = _user_email(user)

    try:
        sign_in = anon_supabase.auth.sign_in_with_password(
            {"email": email, "password": current_password}
        )
    except Exception as exc:
        raise ValueError("Current password is incorrect.") from exc

    if not sign_in or not getattr(sign_in, "user", None):
        raise ValueError("Current password is incorrect.")

    _apply_new_password(supabase=supabase, user_id=user_id, new_password=new_password)
    email_sent = _send_password_changed_notification(email=email, display_name=display_name)

    result: dict = {"message": "Password updated successfully."}
    if email_sent:
        result["email_sent"] = True
    else:
        result["email_sent"] = False
        result["notice"] = (
            "Password updated. Confirmation email was not sent (email provider not configured)."
        )
    return result


def request_password_change_verification(
    *,
    supabase: Client,
    user: object,
    display_name: str | None = None,
) -> dict:
    user_id = _user_id(user)
    email = _user_email(user)
    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)

    meta = _user_metadata(user)
    meta[META_CODE_HASH] = _hash_code(code)
    meta[META_EXPIRES] = expires_at.isoformat()

    supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": meta})

    name = display_name or email
    subject = "LeanChem Connect — password change verification"
    html = f"""
    <p>Hello {name},</p>
    <p>Someone requested to change the password for your LeanChem Connect account (<strong>{email}</strong>).</p>
    <p>Your verification code is:</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">{code}</p>
    <p>This code expires in {CODE_TTL_MINUTES} minutes. If you did not request this, ignore this email and contact your administrator.</p>
    <p>— LeanChem Connect</p>
    """
    text = (
        f"Password change verification for {email}. Code: {code}. "
        f"Expires in {CODE_TTL_MINUTES} minutes."
    )

    try:
        send_email(to=email, subject=subject, html=html, text=text)
    except EmailNotConfiguredError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to send verification email: {exc}") from exc

    return {
        "message": "Verification code sent to your email.",
        "expires_in_minutes": CODE_TTL_MINUTES,
    }


def _fresh_user_metadata(supabase: Client, user_id: str) -> dict:
    """Load latest user_metadata from Supabase (JWT may be stale after request step)."""
    response = supabase.auth.admin.get_user_by_id(user_id)
    if not response or not response.user:
        raise ValueError("User not found")
    auth_user = response.user
    meta = getattr(auth_user, "user_metadata", None) or {}
    return dict(meta) if meta else {}


def confirm_password_change(
    *,
    supabase: Client,
    user: object,
    verification_code: str,
    new_password: str,
    display_name: str | None = None,
) -> dict:
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    user_id = _user_id(user)
    email = _user_email(user)
    meta = _fresh_user_metadata(supabase, user_id)

    stored_hash = meta.get(META_CODE_HASH)
    expires_raw = meta.get(META_EXPIRES)
    if not stored_hash or not expires_raw:
        raise ValueError("No pending password change. Request a new verification code.")

    try:
        expires_at = datetime.fromisoformat(str(expires_raw).replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise ValueError("Invalid verification state. Request a new code.") from exc

    if datetime.now(timezone.utc) > expires_at:
        raise ValueError("Verification code expired. Request a new code.")

    code = verification_code.strip()
    if not code.isdigit() or len(code) != 6:
        raise ValueError("Invalid verification code format.")

    if _hash_code(code) != stored_hash:
        raise ValueError("Incorrect verification code.")

    _apply_new_password(supabase=supabase, user_id=user_id, new_password=new_password)
    _send_password_changed_notification(email=email, display_name=display_name)

    return {"message": "Password updated successfully."}
