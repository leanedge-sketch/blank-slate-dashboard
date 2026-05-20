"""
Send transactional emails via Resend (preferred) or SMTP.
"""
from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings


class EmailNotConfiguredError(RuntimeError):
    pass


def _email_configured() -> bool:
    if settings.RESEND_API_KEY and settings.EMAIL_FROM:
        return True
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USER
        and settings.SMTP_PASSWORD
        and settings.EMAIL_FROM
    )


def send_email(*, to: str, subject: str, html: str, text: str | None = None) -> None:
    if not _email_configured():
        raise EmailNotConfiguredError(
            "Email is not configured. Set RESEND_API_KEY + EMAIL_FROM, or SMTP_* + EMAIL_FROM."
        )

    if settings.RESEND_API_KEY:
        _send_via_resend(to=to, subject=subject, html=html, text=text)
        return
    _send_via_smtp(to=to, subject=subject, html=html, text=text)


def _send_via_resend(*, to: str, subject: str, html: str, text: str | None) -> None:
    payload: dict = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if response.status_code >= 400:
        raise RuntimeError(f"Resend API error ({response.status_code}): {response.text}")


def _send_via_smtp(*, to: str, subject: str, html: str, text: str | None) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    port = settings.SMTP_PORT or 587
    with smtplib.SMTP(settings.SMTP_HOST, port, timeout=30) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, [to], msg.as_string())
