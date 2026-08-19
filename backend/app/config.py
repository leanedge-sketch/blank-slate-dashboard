"""
Application Configuration
This file manages all environment variables and settings for the application.
Think of it as a central place where we store all configuration values.
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env first, then repo-root .env (many devs keep Supabase keys only in root .env)
_backend_dir = Path(__file__).resolve().parents[1]
_repo_root = _backend_dir.parent
load_dotenv(_backend_dir / ".env")
load_dotenv(_repo_root / ".env", override=False)

class Settings(BaseSettings):
    """
    Settings class that holds all application configuration.
    Uses Pydantic for validation and type safety.
    
    Note: BaseSettings automatically reads from .env file and environment variables.
    You don't need to use os.getenv() - just define the fields with defaults.
    """
    
    # Application Info
    APP_NAME: str = "LeanChem product and customer management"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # CORS: configured in main.py (wildcard + credentials via ReflectingWildcardCORSMiddleware).
    # Supabase Configuration
    # These connect us to your Supabase database
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # Anon key for client-side
    SUPABASE_SERVICE_KEY: str = ""  # Service key for admin operations
    
    # AI Provider Settings
    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    MODEL_CHOICE: str = ""  # Legacy alias; maps to OPENAI_CHAT_MODEL when set
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"
    OPENAI_EMBED_DIM: int = 768  # Match existing pgvector(768) schema
    # Gemini — primary chat engine; OpenAI is failover (see app.services.ai_service)
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBED_MODEL: str = "text-embedding-004"
    GROQ_API_KEY: str = ""
    
    # Notifications — WhatsApp (default) and/or Telegram celebrations
    NOTIFICATION_ENABLED: bool = True
    NOTIFICATION_CHANNEL: str = "telegram"  # whatsapp | telegram | both | none
    TELEGRAM_BIG_SALE_THRESHOLD_USD: float = 10000.0  # Shared big-sale bar (USD)

    # WhatsApp Business (Meta Cloud API by default; Twilio optional)
    WHATSAPP_PROVIDER: str = "meta"  # meta | twilio
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_TO: str = ""  # Comma-separated E.164 numbers, e.g. 2547...,2519...
    WHATSAPP_API_VERSION: str = "v21.0"
    WHATSAPP_USE_TEMPLATES: bool = False
    WHATSAPP_TEMPLATE_LANGUAGE: str = "en"
    WHATSAPP_TEMPLATE_DEAL_CLOSED: str = ""
    WHATSAPP_TEMPLATE_BIG_SALE: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""  # e.g. whatsapp:+14155238886

    # Telegram (optional — set NOTIFICATION_CHANNEL=telegram or both)
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""  # Comma-separated chat/group ids
    TELEGRAM_NOTIFY_INTERACTIONS: bool = False  # Quiet routine CRM interaction spam
    
    # Web Search APIs
    GOOGLE_PSE_API_KEY: str = ""  # Google Programmable Search Engine API key
    GOOGLE_PSE_CX: str = ""  # Google Custom Search Engine ID
    SERPAPI_API_KEY: str = ""  # SerpAPI key for web search
    
    # File Upload Limits
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB in bytes
    ALLOWED_FILE_TYPES: List[str] = ["pdf", "docx", "txt", "png", "jpg", "jpeg"]
    UPLOAD_BUCKET: str = "documents"  # Supabase storage bucket name
    
    # Database Connection Pool
    DB_POOL_SIZE: int = 10  # Number of concurrent DB connections
    
    # Email (password change verification & notifications)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = ""  # e.g. "LeanChem Connect <noreply@yourdomain.com>"
    RESEND_REPLY_TO: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    # Loop A / Loop B — shared public-site Supabase (leanchemweb rfqs + suppliers)
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_ANON_KEY: str = ""
    LOOP_A_SUPABASE_URL: str = ""
    LOOP_A_SUPABASE_ANON_KEY: str = ""
    LOOP_A_SUPABASE_SERVICE_KEY: str = ""

    # Security Settings
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # When true, signed-in Supabase Auth users without an employees row are
    # auto-inserted (default role: sales). Safe when Auth sign-up is invite-only.
    EMPLOYEE_AUTO_PROVISION_AUTH_USERS: bool = True
    
    # Pagination Defaults
    DEFAULT_PAGE_SIZE: int = 20  # How many items per page by default
    MAX_PAGE_SIZE: int = 100  # Maximum items per page (prevents abuse)
    
    class Config:
        env_file = ".env"  # Read from .env file
        env_file_encoding = "utf-8"  # Encoding for .env file
        case_sensitive = True  # Environment variable names are case-sensitive
        extra = "ignore"  # Ignore extra fields in .env (don't raise error)

# Create a single instance that can be imported anywhere
settings = Settings()

