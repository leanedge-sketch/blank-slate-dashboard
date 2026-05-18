"""
FastAPI Main Application Entry Point
This is the "heart" of your backend - it starts the server and connects all the pieces.

Think of it as:
- The main file that runs when you start the server
- Where all your API routes are registered
- Where middleware (like CORS) is configured
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.cors_relaxed import ReflectingWildcardCORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
from dotenv import load_dotenv
import threading

# Import our configuration
from app.config import settings

# Import database connection (we'll use this later)
from app.database.connection import get_supabase_client, get_supabase_service_client

# Import API routers
from app.api.v1 import crm, pms, sales_pipeline, stock, auth
# from app.api.v1 import common  # We'll add this later

# Load environment variables
load_dotenv()

# ============================================
# LIFESPAN: Startup and Shutdown Events
# ============================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    This function runs when the server starts and stops.
    
    Startup: Things to do when server starts
    - Initialize connections
    - Load data
    - Start background tasks
    
    Shutdown: Things to do when server stops
    - Close connections
    - Clean up resources
    """
    # STARTUP - Runs when server starts
    print("Starting LeanChem Connect API...")
    print(f"App: {settings.APP_NAME}")
    print(f"Version: {settings.APP_VERSION}")
    
    # Test database connection
    try:
        supabase = get_supabase_client()
        print("Database connection successful (anon key)")
    except Exception as e:
        print(f"Database connection failed (anon key): {e}")
    
    # Test service key (used for admin operations like checking employees)
    try:
        service_client = get_supabase_service_client()
        print("Service key connection successful")
    except Exception as e:
        print(f"⚠️  Service key connection failed: {e}")
        print("   This will cause authentication errors. Please check your SUPABASE_SERVICE_KEY in backend/.env")
    
    # You can add more startup tasks here:
    # - Initialize notification service
    # - Load cache
    # - Start background workers

    # Optionally start the ICP profile update worker in the background.
    # Control this via environment variable to avoid running workers on every instance.
    enable_profile_worker = os.getenv("ENABLE_PROFILE_WORKER", "").lower() in {"1", "true", "yes"}
    worker_thread: threading.Thread | None = None
    if enable_profile_worker:
        try:
            from app.workers.profile_update_worker import ProfileUpdateWorker

            def _run_worker() -> None:
                worker = ProfileUpdateWorker()
                worker.run_forever()

            worker_thread = threading.Thread(target=_run_worker, name="profile_update_worker", daemon=True)
            worker_thread.start()
            print("ProfileUpdateWorker started in background thread")
        except Exception as e:
            print(f"Failed to start ProfileUpdateWorker: {e}")
    
    yield  # Server runs here
    
    # SHUTDOWN - Runs when server stops
    print("Shutting down LeanChem Connect API...")
    # Clean up tasks here:
    # - Close database connections
    # - Stop background workers

# ============================================
# CREATE FASTAPI APP
# ============================================
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered CRM and Product Management System",
    version=settings.APP_VERSION,
    docs_url="/api/docs",      # Swagger UI at http://localhost:8000/api/docs
    redoc_url="/api/redoc",    # ReDoc at http://localhost:8000/api/redoc
    lifespan=lifespan          # Use our startup/shutdown function
)

# ============================================
# EXCEPTION HANDLERS
# ============================================
# Better error messages for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log validation errors for debugging."""
    logger = logging.getLogger(__name__)
    try:
        body = await request.body()
        body_str = str(body)[:500] if body else "No body"
    except Exception:
        body_str = "Could not read body"
    
    error_details = {
        "path": request.url.path,
        "errors": exc.errors(),
        "content_type": request.headers.get("content-type", "Not set"),
        "body_preview": body_str
    }
    
    logger.error(f"Validation error: {error_details}")
    print(f"\nVALIDATION ERROR on {request.url.path}")
    print(f"   Content-Type: {request.headers.get('content-type', 'Not set')}")
    print(f"   Errors: {exc.errors()}")
    print(f"   Body preview: {body_str}\n")
    
    # Convert errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": error.get("input"),
        }
        # Handle ctx if it exists and contains an error object
        if "ctx" in error and error["ctx"]:
            ctx = error["ctx"].copy()
            if "error" in ctx:
                # Convert ValueError or other exceptions to string
                if isinstance(ctx["error"], Exception):
                    ctx["error"] = str(ctx["error"])
            error_dict["ctx"] = ctx
        errors.append(error_dict)
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": errors,
            "body_preview": body_str,
            "content_type": request.headers.get("content-type", "Not set")
        }
    )

# ============================================
# CORS MIDDLEWARE
# ============================================
# Wildcard origins + credentials: use ReflectingWildcardCORSMiddleware so the real
# Origin is echoed (browsers disallow literal * with Access-Control-Allow-Credentials: true).
app.add_middleware(
    ReflectingWildcardCORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

print("CORS: allow_origins=['*'], allow_credentials=True (reflecting wildcard middleware)")

# ============================================
# HEALTH CHECK ENDPOINT
# ============================================
@app.get("/health")
async def health_check():
    """
    Simple health check endpoint.
    Useful for monitoring and checking if server is running.
    
    Try it: http://localhost:8000/health
    """
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

# ============================================
# ROOT ENDPOINT
# ============================================
@app.get("/")
async def root():
    """
    Root endpoint - welcome message.
    
    Try it: http://localhost:8000/
    """
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
        "health": "/health"
    }

# ============================================
# REGISTER API ROUTERS
# ============================================
# Register CRM routes
app.include_router(crm.router, prefix="/api/v1/crm", tags=["CRM"])

# Register PMS routes
app.include_router(pms.router, prefix="/api/v1/pms", tags=["PMS"])

# Register Sales Pipeline routes
app.include_router(sales_pipeline.router, prefix="/api/v1", tags=["Sales Pipeline"])

# Register Stock Management routes
app.include_router(stock.router, prefix="/api/v1", tags=["Stock Management"])

# Register Authentication routes
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])

# We'll add these later:
# app.include_router(common.router, prefix="/api/v1", tags=["Common"])

# ============================================
# RUN SERVER (for development)
# ============================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",  # Path to the app
        host="0.0.0.0",  # Listen on all network interfaces
        port=8000,       # Port number
        reload=True       # Auto-reload on code changes (development only)
    )

