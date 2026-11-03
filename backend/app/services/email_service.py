"""
Send transactional emails via Resend (preferred) or SMTP.
Supports optional PDF/file attachments for executive briefings.
"""
from __future__ import annotations

import base64
import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Sequence

import httpx

from app.config import settings


class EmailNotConfiguredError(RuntimeError):
    pass


class EmailAttachment:
    def __init__(self, *, filename: str, content: bytes, content_type: str = "application/pdf"):
        self.filename = filename
        self.content = content
        self.content_type = content_type


DEFAULT_RESEND_FROM = "LeanChem Connect <onboarding@resend.dev>"


def email_is_configured() -> bool:
    return _email_configured()


def _email_configured() -> bool:
    if settings.RESEND_API_KEY:
        return True
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
    )


def send_email(
    *,
    to: str | list[str],
    subject: str,
    html: str,
    text: str | None = None,
    bcc: list[str] | None = None,
    reply_to: str | None = None,
    attachments: Sequence[EmailAttachment] | None = None,
) -> None:
    if not _email_configured():
        raise EmailNotConfiguredError(
            "Email is not configured. Set RESEND_API_KEY + EMAIL_FROM, or SMTP_* + EMAIL_FROM."
        )

    to_list = [to] if isinstance(to, str) else list(to)
    if settings.RESEND_API_KEY:
        _send_via_resend(
            to=to_list,
            subject=subject,
            html=html,
            text=text,
            bcc=bcc,
            reply_to=reply_to,
            attachments=attachments,
        )
        return

    # SMTP path: send one message per recipient when BCC unsupported simply
    primary = to_list[0]
    _send_via_smtp(
        to=primary,
        subject=subject,
        html=html,
        text=text,
        attachments=attachments,
    )
    for extra in bcc or []:
        _send_via_smtp(
            to=extra,
            subject=subject,
            html=html,
            text=text,
            attachments=attachments,
        )
    for extra in to_list[1:]:
        _send_via_smtp(
            to=extra,
            subject=subject,
            html=html,
            text=text,
            attachments=attachments,
        )


def _send_via_resend(
    *,
    to: list[str],
    subject: str,
    html: str,
    text: str | None,
    bcc: list[str] | None = None,
    reply_to: str | None = None,
    attachments: Sequence[EmailAttachment] | None = None,
) -> None:
    sender = (settings.EMAIL_FROM or "").strip() or DEFAULT_RESEND_FROM
    payload: dict = {
        "from": sender,
        "to": to,
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    if bcc:
        payload["bcc"] = bcc
    if reply_to or settings.RESEND_REPLY_TO:
        payload["reply_to"] = reply_to or settings.RESEND_REPLY_TO
    if attachments:
        payload["attachments"] = [
            {
                "filename": item.filename,
                "content": base64.b64encode(item.content).decode("ascii"),
                "content_type": item.content_type,
            }
            for item in attachments
        ]

    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            "https://api.resend.com/emails",
            headers=headers,
            json=payload,
        )
        if response.status_code >= 400 and sender != DEFAULT_RESEND_FROM:
            # Fallback to Resend onboarding sender if custom domain is not yet verified
            fallback_payload = {**payload, "from": DEFAULT_RESEND_FROM}
            retry_resp = client.post(
                "https://api.resend.com/emails",
                headers=headers,
                json=fallback_payload,
            )
            if retry_resp.status_code < 400:
                return
    if response.status_code >= 400:
        raise RuntimeError(f"Resend API error ({response.status_code}): {response.text}")


def _send_via_smtp(
    *,
    to: str,
    subject: str,
    html: str,
    text: str | None,
    attachments: Sequence[EmailAttachment] | None = None,
) -> None:
    sender = (settings.EMAIL_FROM or "").strip() or settings.SMTP_USER
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    alt = MIMEMultipart("alternative")
    if text:
        alt.attach(MIMEText(text, "plain"))
    alt.attach(MIMEText(html, "html"))
    msg.attach(alt)

    for item in attachments or []:
        part = MIMEApplication(item.content, Name=item.filename)
        part.add_header("Content-Disposition", "attachment", filename=item.filename)
        if item.content_type:
            part.set_type(item.content_type)
        msg.attach(part)

    port = settings.SMTP_PORT or 587
    with smtplib.SMTP(settings.SMTP_HOST, port, timeout=30) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(sender, [to], msg.as_string())
