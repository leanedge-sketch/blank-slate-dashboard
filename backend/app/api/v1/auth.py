"""
Authentication API Routes
=========================

HTTP endpoints for authentication and employee management:
- POST /api/v1/auth/check-employee  → Check if email exists in employees table
- GET  /api/v1/auth/me              → Get current user's employee info
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from supabase import Client
from app.database.connection import get_supabase_client, get_supabase_service_client
from app.dependencies import get_current_user

router = APIRouter()


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

