"""
Application Configuration
This file manages all environment variables and settings for the application.
Think of it as a central place where we store all configuration values.
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"
    OPENAI_EMBED_DIM: int = 768  # Match existing pgvector(768) schema
    # Legacy / fallback keys (unused — kept so older .env files don't break)
    GEMINI_API_KEY: str = ""
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBED_MODEL: str = "text-embedding-004"
    GROQ_API_KEY: str = ""
    
    # Telegram Notifications
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""  # Comma-separated chat IDs
    NOTIFICATION_ENABLED: bool = False
    
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
    
    # Security Settings
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
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

