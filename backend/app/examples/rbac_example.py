"""
Example: How to use Role-Based Access Control in your endpoints

This file shows you how to protect endpoints with different roles.
"""
from fastapi import APIRouter, Depends
from app.dependencies import (
    get_current_user,
    require_role,
    require_ceo,
    require_admin,
    require_manager,
    require_own_team_or_admin
)

router = APIRouter()

# ============================================
# EXAMPLE 1: Only CEO can access
# ============================================
@router.get("/ceo-only")
async def ceo_dashboard(user: dict = Depends(require_ceo)):
    """
    Only CEO can see this.
    """
    return {"message": f"Welcome CEO {user.get('email')}"}

# ============================================
# EXAMPLE 2: CEO or Admin can access
# ============================================
@router.get("/admin-panel")
async def admin_panel(user: dict = Depends(require_admin)):
    """
    CEO and Admin can access.
    """
    return {"message": "Admin panel", "user": user.get("email")}

# ============================================
# EXAMPLE 3: Multiple roles can access
# ============================================
@router.get("/management-view")
async def management_view(user: dict = Depends(require_manager)):
    """
    CEO, Admin, or Manager can access.
    """
    return {"message": "Management view", "user": user.get("email")}

# ============================================
# EXAMPLE 4: Custom role list
# ============================================
@router.get("/developer-tools")
async def developer_tools(user: dict = Depends(require_role(["ceo", "admin", "developer"]))):
    """
    Only CEO, Admin, or Developer can access.
    """
    return {"message": "Developer tools", "user": user.get("email")}

# ============================================
# EXAMPLE 5: Manager sees only their team
# ============================================
@router.get("/my-team")
async def get_my_team(
    user: dict = Depends(require_own_team_or_admin),
    supabase = Depends(get_supabase_client)
):
    """
    Manager sees only their employees.
    CEO/Admin see everyone.
    """
    from app.dependencies import get_user_role, get_user_team_members
    
    role = get_user_role(user)
    user_id = user.get("id")
    
    if role in ["ceo", "admin"]:
        # Get all employees
        result = supabase.table("users").select("*").execute()
        return {"team": result.data, "role": role}
    else:
        # Manager - get only their team
        team = await get_user_team_members(user_id, supabase)
        return {"team": team, "role": role}

# ============================================
# EXAMPLE 6: Employee can only see their own data
# ============================================
@router.get("/my-profile")
async def my_profile(user: dict = Depends(get_current_user)):
    """
    Any authenticated user can see their own profile.
    """
    return {"profile": user}

# ============================================
# EXAMPLE 7: Complex - Manager edits their team member
# ============================================
@router.put("/employees/{employee_id}")
async def update_employee(
    employee_id: str,
    employee_data: dict,
    user: dict = Depends(require_manager),
    supabase = Depends(get_supabase_client)
):
    """
    Manager can only update employees in their team.
    Admin/CEO can update anyone.
    """
    from app.dependencies import get_user_role, get_user_team_members
    
    role = get_user_role(user)
    user_id = user.get("id")
    
    # Check if employee exists
    employee = supabase.table("users").select("*").eq("id", employee_id).execute()
    if not employee.data:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # If not admin/CEO, check if employee is in manager's team
    if role not in ["ceo", "admin"]:
        team = await get_user_team_members(user_id, supabase)
        team_ids = [member["id"] for member in team]
        
        if employee_id not in team_ids:
            raise HTTPException(
                status_code=403,
                detail="You can only update employees in your team"
            )
    
    # Update the employee
    result = supabase.table("users").update(employee_data).eq("id", employee_id).execute()
    return {"updated": result.data}

