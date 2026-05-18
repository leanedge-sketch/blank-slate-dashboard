"""
FastAPI Dependencies
This file contains reusable functions that FastAPI endpoints can use.
We'll add role-based access control here.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from app.database.connection import get_supabase_client
from typing import Optional, List

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase_client)
) -> dict:
    """
    Get current authenticated user from JWT token.
    This validates the token and returns user info.
    """
    try:
        token = credentials.credentials
        # Verify token with Supabase
        user = supabase.auth.get_user(token)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        return user.user
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}"
        )

def get_user_role(user: dict) -> str:
    """
    Extract user role from user metadata.
    Roles can be stored in Supabase user metadata or a separate roles table.
    """
    # Option 1: From user metadata (set during signup)
    if user.get("user_metadata") and user["user_metadata"].get("role"):
        return user["user_metadata"]["role"]
    
    # Option 2: From app_metadata (set by admin)
    if user.get("app_metadata") and user["app_metadata"].get("role"):
        return user["app_metadata"]["role"]
    
    # Default role if none set
    return "employee"

# ============================================
# ROLE-BASED ACCESS CONTROL (RBAC) FUNCTIONS
# ============================================

def require_role(allowed_roles: List[str]):
    """
    Create a dependency that checks if user has one of the allowed roles.
    
    Usage in endpoint:
    @router.get("/admin-only")
    async def admin_endpoint(user: dict = Depends(require_role(["ceo", "admin"]))):
        ...
    """
    async def role_checker(
        user: dict = Depends(get_current_user)
    ) -> dict:
        user_role = get_user_role(user)
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        
        return user
    return role_checker

# Pre-defined role checkers for common cases
def require_ceo(user: dict = Depends(get_current_user)) -> dict:
    """Only CEO can access"""
    if get_user_role(user) != "ceo":
        raise HTTPException(status_code=403, detail="CEO access required")
    return user

def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """CEO or Admin can access"""
    role = get_user_role(user)
    if role not in ["ceo", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def require_manager(user: dict = Depends(get_current_user)) -> dict:
    """CEO, Admin, or Manager can access"""
    role = get_user_role(user)
    if role not in ["ceo", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    return user

def require_employee(user: dict = Depends(get_current_user)) -> dict:
    """Any authenticated user can access"""
    return user  # Everyone can access

# ============================================
# HIERARCHICAL ACCESS (Manager sees only their team)
# ============================================

async def get_user_team_members(
    manager_id: str,
    supabase: Client = Depends(get_supabase_client)
) -> List[dict]:
    """
    Get all employees under a manager.
    This assumes you have a 'users' or 'employees' table with a 'manager_id' field.
    """
    result = supabase.table("users").select("*").eq("manager_id", manager_id).execute()
    return result.data if result.data else []

def require_own_team_or_admin(user: dict = Depends(get_current_user)):
    """
    Manager can only see their own team, but admin/CEO can see all.
    """
    role = get_user_role(user)
    user_id = user.get("id")
    
    # CEO and Admin can see everything
    if role in ["ceo", "admin"]:
        return user
    
    # Manager can only see their team
    if role == "manager":
        # The user object will have their team info
        # You'll check this in the actual endpoint
        return user
    
    # Employees can't access this
    raise HTTPException(status_code=403, detail="Manager or Admin access required")

