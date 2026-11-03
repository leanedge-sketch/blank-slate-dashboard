"""
Password change and admin-assisted password reset service.
When a user forgets their password or wants to change it, a reset link is emailed
to the administrator (katysolomon95@gmail.com) so a new password can be assigned.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from supabase import Client

from app.config import settings
from app.services.email_service import EmailNotConfiguredError, send_email

CODE_TTL_MINUTES = 15
RESET_TOKEN_TTL_HOURS = 24
DEFAULT_ADMIN_RESET_EMAIL = "katysolomon95@gmail.com"
DEFAULT_FRONTEND_BASE_URL = "https://blank-slate-dashboard-plum.vercel.app"
META_CODE_HASH = "password_change_code_hash"
META_EXPIRES = "password_change_expires"
META_NEW_PASSWORD_HASH = "password_change_new_password_hash"
META_LAST_RESET_NONCE = "last_reset_nonce"
META_PENDING_ADMIN_RESET_TOKEN = "pending_admin_reset_token"


def _admin_reset_email() -> str:
    configured = (getattr(settings, "PASSWORD_RESET_ADMIN_EMAIL", "") or "").strip()
    return configured or DEFAULT_ADMIN_RESET_EMAIL


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


def _pepper() -> str:
    return settings.JWT_SECRET or settings.SUPABASE_SERVICE_KEY or "leanchem"


def _hash_code(code: str) -> str:
    return hashlib.sha256(f"{_pepper()}:{code}".encode()).hexdigest()


def _hash_new_password(password: str) -> str:
    return hashlib.sha256(f"{_pepper()}:new:{password}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"


def create_password_reset_token(
    *,
    email: str,
    display_name: str | None = None,
    reason: str = "forgot_password",
    ttl_hours: int = RESET_TOKEN_TTL_HOURS,
) -> str:
    """Create an HMAC-signed token allowing the administrator to assign a new password."""
    normalized_email = str(email or "").lower().strip()
    if not normalized_email:
        raise ValueError("Email address is required")
    now = datetime.now(timezone.utc)
    payload = {
        "email": normalized_email,
        "name": (display_name or "").strip(),
        "reason": reason,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=ttl_hours)).timestamp()),
        "nonce": secrets.token_hex(8),
    }
    raw_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_json).decode("ascii").rstrip("=")
    sig = hmac.new(
        _pepper().encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_password_reset_token(token: str) -> dict:
    """Verify signature and expiration of a password reset token and return its payload."""
    cleaned = (token or "").strip()
    if not cleaned or "." not in cleaned:
        raise ValueError("Invalid password reset link.")
    payload_b64, sig = cleaned.rsplit(".", 1)
    expected_sig = hmac.new(
        _pepper().encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("Invalid password reset link.")

    padding = "=" * (-len(payload_b64) % 4)
    try:
        raw_json = base64.urlsafe_b64decode((payload_b64 + padding).encode("ascii"))
        payload = json.loads(raw_json.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Invalid password reset link.") from exc

    if not isinstance(payload, dict) or not payload.get("email"):
        raise ValueError("Invalid password reset link.")

    exp = int(payload.get("exp") or 0)
    if int(datetime.now(timezone.utc).timestamp()) > exp:
        raise ValueError("This reset link has expired. Please request a new reset link.")

    return payload


def _extract_users_list(response: object) -> list:
    if isinstance(response, list):
        return response
    users = getattr(response, "users", None)
    if isinstance(users, list):
        return users
    data = getattr(response, "data", None)
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("users"), list):
        return data["users"]
    return []


def _find_auth_user_by_email(supabase: Client, email: str) -> object | None:
    target = str(email or "").lower().strip()
    if not target:
        return None
    page = 1
    per_page = 1000
    while page <= 10:
        try:
            res = supabase.auth.admin.list_users(page=page, per_page=per_page)
        except TypeError:
            res = supabase.auth.admin.list_users()
        users = _extract_users_list(res)
        for u in users:
            u_email = u.get("email") if isinstance(u, dict) else getattr(u, "email", None)
            if u_email and str(u_email).lower().strip() == target:
                return u
        if len(users) < per_page:
            break
        page += 1
    return None


def _store_pending_reset_on_admin(supabase: Client, token: str) -> None:
    """Save the latest reset token on the admin user's metadata as a fallback."""
    try:
        admin_user = _find_auth_user_by_email(supabase, _admin_reset_email())
        if not admin_user:
            return
        admin_uid = _user_id(admin_user)
        meta = _user_metadata(admin_user)
        meta[META_PENDING_ADMIN_RESET_TOKEN] = token
        supabase.auth.admin.update_user_by_id(admin_uid, {"user_metadata": meta})
    except Exception:
        pass


def _clear_pending_reset_on_admin(supabase: Client, token: str) -> None:
    try:
        admin_user = _find_auth_user_by_email(supabase, _admin_reset_email())
        if not admin_user:
            return
        admin_uid = _user_id(admin_user)
        meta = _user_metadata(admin_user)
        if meta.get(META_PENDING_ADMIN_RESET_TOKEN) == token:
            meta.pop(META_PENDING_ADMIN_RESET_TOKEN, None)
            supabase.auth.admin.update_user_by_id(admin_uid, {"user_metadata": meta})
    except Exception:
        pass


def request_password_reset_link(
    *,
    supabase: Client,
    anon_supabase: Client | None = None,
    email: str,
    display_name: str | None = None,
    reason: str = "forgot_password",
    redirect_base: str | None = None,
) -> dict:
    """
    Generate a signed reset link for `email` and send it to katysolomon95@gmail.com
    so the administrator can assign a new password.
    """
    target_email = str(email or "").lower().strip()
    if not target_email:
        raise ValueError("Email address is required.")

    admin_email = _admin_reset_email()
    base_url = (redirect_base or "").strip().rstrip("/") or DEFAULT_FRONTEND_BASE_URL
    token = create_password_reset_token(
        email=target_email,
        display_name=display_name,
        reason=reason,
    )
    reset_link = f"{base_url}/auth/set-password?token={token}"

    _store_pending_reset_on_admin(supabase, token)

    reason_label = (
        "Forgot password (login screen)"
        if reason == "forgot_password"
        else "Password change request"
    )
    account_label = f"{display_name} ({target_email})" if display_name else target_email

    subject = f"LeanChem Connect — Password reset link for {target_email}"
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
      <h2 style="margin:0 0 12px;color:#0f172a;">Password Reset / Assignment Request</h2>
      <p style="margin:0 0 12px;line-height:1.5;">
        A user has requested to reset or change their LeanChem Connect password.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;">
        <p style="margin:0 0 6px;"><strong>Employee:</strong> {account_label}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> {target_email}</p>
        <p style="margin:0;"><strong>Request Type:</strong> {reason_label}</p>
      </div>
      <p style="margin:16px 0;">
        Click the button below to open the password assignment page and set a new password for <strong>{target_email}</strong>:
      </p>
      <p style="margin:24px 0;">
        <a href="{reset_link}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">
          Assign New Password
        </a>
      </p>
      <p style="font-size:12px;color:#475569;word-break:break-all;">
        Or copy and paste this link into your browser:<br/>
        <a href="{reset_link}">{reset_link}</a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:20px;">
        This link expires in {RESET_TOKEN_TTL_HOURS} hours.
      </p>
    </div>
    """
    text = (
        f"Password Reset / Assignment Request for {account_label}\n"
        f"Request Type: {reason_label}\n\n"
        f"Open this link to assign a new password for {target_email}:\n"
        f"{reset_link}\n\n"
        f"This link expires in {RESET_TOKEN_TTL_HOURS} hours."
    )

    email_sent = False
    last_error: Exception | None = None
    try:
        send_email(
            to=admin_email,
            subject=subject,
            html=html,
            text=text,
            reply_to=target_email,
        )
        email_sent = True
    except Exception as exc:
        last_error = exc

    if not email_sent and anon_supabase is not None:
        # Fallback: trigger Supabase Auth recovery email to admin_email with redirect carrying the token
        try:
            callback_redirect = f"{base_url}/auth/callback?type=reset&token={token}"
            anon_supabase.auth.reset_password_for_email(
                admin_email,
                {"redirect_to": callback_redirect},
            )
            email_sent = True
        except Exception as supa_exc:
            if last_error is None:
                last_error = supa_exc

    if not email_sent and last_error is not None:
        if isinstance(last_error, EmailNotConfiguredError):
            raise last_error
        raise RuntimeError(f"Failed to send password reset link to {admin_email}: {last_error}") from last_error

    return {
        "message": (
            f"A password reset link for {target_email} has been sent to {admin_email} "
            "so a new password can be assigned."
        ),
        "admin_email": admin_email,
        "target_email": target_email,
        "email_sent": True,
        "expires_in_hours": RESET_TOKEN_TTL_HOURS,
    }


def assign_password_with_token(
    *,
    supabase: Client,
    token: str,
    new_password: str,
    display_name: str | None = None,
) -> dict:
    """
    Verify the admin reset token and assign `new_password` to the target user in Supabase Auth.
    """
    if len(new_password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    payload = verify_password_reset_token(token)
    target_email = str(payload["email"]).lower().strip()
    nonce = str(payload.get("nonce") or "")
    resolved_name = display_name or payload.get("name") or None
    now_iso = datetime.now(timezone.utc).isoformat()

    auth_user = _find_auth_user_by_email(supabase, target_email)
    if auth_user is not None:
        user_id = _user_id(auth_user)
        meta = _fresh_user_metadata(supabase, user_id)
        if nonce and meta.get(META_LAST_RESET_NONCE) == nonce:
            raise ValueError("This reset link has already been used. Please request a new reset link.")
        cleaned_meta = {
            k: v
            for k, v in meta.items()
            if k not in (META_CODE_HASH, META_EXPIRES, META_NEW_PASSWORD_HASH)
        }
        cleaned_meta["password_set"] = True
        cleaned_meta["password_set_at"] = now_iso
        if nonce:
            cleaned_meta[META_LAST_RESET_NONCE] = nonce
        if resolved_name and not cleaned_meta.get("full_name"):
            cleaned_meta["full_name"] = resolved_name

        supabase.auth.admin.update_user_by_id(
            user_id,
            {
                "password": new_password,
                "email_confirm": True,
                "user_metadata": cleaned_meta,
            },
        )
    else:
        # Target employee does not have an auth.users record yet — create it with the assigned password
        user_meta: dict = {
            "password_set": True,
            "password_set_at": now_iso,
        }
        if nonce:
            user_meta[META_LAST_RESET_NONCE] = nonce
        if resolved_name:
            user_meta["full_name"] = resolved_name

        supabase.auth.admin.create_user(
            {
                "email": target_email,
                "password": new_password,
                "email_confirm": True,
                "user_metadata": user_meta,
            }
        )

    _clear_pending_reset_on_admin(supabase, token)
    _send_password_changed_notification(email=target_email, display_name=resolved_name)

    return {
        "message": f"New password has been assigned for {target_email}.",
        "email": target_email,
    }


def _send_password_changed_notification(
    *,
    email: str,
    display_name: str | None = None,
) -> bool:
    """Send confirmation email after a successful password change. Returns True if sent."""
    admin_email = _admin_reset_email()
    name = display_name or email
    subject = f"LeanChem Connect — password updated for {email}"
    html = f"""
    <p>Hello,</p>
    <p>This confirms that the password for LeanChem Connect account <strong>{name}</strong> (<strong>{email}</strong>) was updated successfully.</p>
    <p>— LeanChem Connect</p>
    """
    text = f"The LeanChem Connect password for {email} was updated successfully."
    try:
        send_email(to=admin_email, subject=subject, html=html, text=text)
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
        if k
        not in (META_CODE_HASH, META_EXPIRES, META_NEW_PASSWORD_HASH)
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


def request_password_change_with_current(
    *,
    supabase: Client,
    anon_supabase: Client,
    user: object,
    current_password: str,
    new_password: str,
    display_name: str | None = None,
) -> dict:
    """
    Verify current password, then email a 6-digit code. New password is bound to this
    request and must match on confirm.
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

    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)

    meta = _fresh_user_metadata(supabase, user_id)
    meta[META_CODE_HASH] = _hash_code(code)
    meta[META_EXPIRES] = expires_at.isoformat()
    meta[META_NEW_PASSWORD_HASH] = _hash_new_password(new_password)

    supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": meta})

    admin_email = _admin_reset_email()
    token = create_password_reset_token(
        email=email,
        display_name=display_name,
        reason="change_password",
    )
    reset_link = f"{DEFAULT_FRONTEND_BASE_URL}/auth/set-password?token={token}"
    _store_pending_reset_on_admin(supabase, token)

    name = display_name or email
    subject = f"LeanChem Connect — password change / reset link for {email}"
    html = f"""
    <p>Hello,</p>
    <p><strong>{name}</strong> (<strong>{email}</strong>) requested to change their LeanChem Connect password.</p>
    <p>Click the link below to assign a new password for <strong>{email}</strong>:</p>
    <p><a href="{reset_link}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">Assign New Password</a></p>
    <p style="font-size:12px;color:#475569;word-break:break-all;"><a href="{reset_link}">{reset_link}</a></p>
    <p>Verification code (if completing in-app): <strong style="font-size:20px;letter-spacing:3px;">{code}</strong> (expires in {CODE_TTL_MINUTES} minutes).</p>
    <p>— LeanChem Connect</p>
    """
    text = (
        f"Password change requested for {email}.\n"
        f"Assign a new password here: {reset_link}\n"
        f"Verification code: {code} (expires in {CODE_TTL_MINUTES} minutes)."
    )

    try:
        send_email(to=admin_email, subject=subject, html=html, text=text, reply_to=email)
    except EmailNotConfiguredError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to send verification email: {exc}") from exc

    return {
        "message": f"Password reset link and verification sent to {admin_email}.",
        "admin_email": admin_email,
        "expires_in_minutes": CODE_TTL_MINUTES,
        "email_sent": True,
    }


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

    admin_email = _admin_reset_email()
    token = create_password_reset_token(
        email=email,
        display_name=display_name,
        reason="change_password",
    )
    reset_link = f"{DEFAULT_FRONTEND_BASE_URL}/auth/set-password?token={token}"
    _store_pending_reset_on_admin(supabase, token)

    name = display_name or email
    subject = f"LeanChem Connect — password reset link for {email}"
    html = f"""
    <p>Hello,</p>
    <p><strong>{name}</strong> (<strong>{email}</strong>) requested to change their LeanChem Connect password.</p>
    <p>Click the link below to assign a new password for <strong>{email}</strong>:</p>
    <p><a href="{reset_link}" style="display:inline-block;background:#0284c7;color:#ffffff;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">Assign New Password</a></p>
    <p style="font-size:12px;color:#475569;word-break:break-all;"><a href="{reset_link}">{reset_link}</a></p>
    <p>Verification code: <strong style="font-size:20px;letter-spacing:3px;">{code}</strong> (expires in {CODE_TTL_MINUTES} minutes).</p>
    <p>— LeanChem Connect</p>
    """
    text = (
        f"Password change requested for {email}.\n"
        f"Assign a new password here: {reset_link}\n"
        f"Verification code: {code} (expires in {CODE_TTL_MINUTES} minutes)."
    )

    try:
        send_email(to=admin_email, subject=subject, html=html, text=text, reply_to=email)
    except EmailNotConfiguredError:
        raise
    except Exception as exc:
        raise RuntimeError(f"Failed to send verification email: {exc}") from exc

    return {
        "message": f"Password reset link sent to {admin_email}.",
        "admin_email": admin_email,
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

    pending_new_hash = meta.get(META_NEW_PASSWORD_HASH)
    if pending_new_hash and _hash_new_password(new_password) != pending_new_hash:
        raise ValueError(
            "New password does not match the one you entered before the verification code was sent."
        )

    _apply_new_password(supabase=supabase, user_id=user_id, new_password=new_password)
    _send_password_changed_notification(email=email, display_name=display_name)

    return {"message": "Password updated successfully."}
