# Role-Based Access Control (RBAC) Implementation

This document explains the RBAC system implemented for LeanChem Connect.

## Employee Roles

The system supports the following roles with specific permissions:

1. **admin** - Can view and edit all sections (CRM, PMS, Sales Pipeline, Stock)
2. **product manager** - Can view all sections, but can only edit PMS
3. **sales and stock** - Can view all sections, but cannot edit PMS
4. **sales** - Can view all sections, but cannot edit PMS and Stock Management
5. **logistic** - Can view all sections, but can only edit PMS

## Permission Matrix

| Role | View CRM | Edit CRM | View PMS | Edit PMS | View Sales | Edit Sales | View Stock | Edit Stock |
|------|----------|----------|----------|----------|------------|------------|------------|------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| product manager | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| sales and stock | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| sales | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| logistic | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |

## Database Setup

### 1. Create the Employees Table

Run the SQL script to create the employees table:

```sql
-- Located at: backend/scripts/create_employees_table.sql
```

The table structure:
- `id` (UUID, primary key)
- `email` (TEXT, unique, must match Supabase Auth email)
- `name` (TEXT, optional)
- `role` (TEXT, one of: 'admin', 'product manager', 'sales and stock', 'sales', 'logistic')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### 2. Insert Employees

Example SQL to add employees:

```sql
INSERT INTO public.employees (email, name, role) VALUES
  ('admin@leanchem.com', 'Admin User', 'admin'),
  ('product.manager@leanchem.com', 'Product Manager', 'product manager'),
  ('sales@leanchem.com', 'Sales Person', 'sales');
```

**Important**: The email in the `employees` table must match the email used in Supabase Auth.

## Using Permissions in Components

### Basic Usage

```tsx
import { useCanEdit, useCanView, usePermissions } from "../hooks/usePermissions";

function MyComponent() {
  const canEditCRM = useCanEdit("crm");
  const canViewPMS = useCanView("pms");
  const permissions = usePermissions();

  return (
    <div>
      {canViewPMS && <PMSComponent />}
      {canEditCRM && <button>Edit CRM Data</button>}
    </div>
  );
}
```

### Using Auth Context

```tsx
import { useAuth } from "../contexts/AuthContext";

function MyComponent() {
  const { employeeRole, permissions, employeeData } = useAuth();

  return (
    <div>
      <p>Logged in as: {employeeData?.name || employeeData?.email}</p>
      <p>Role: {employeeRole}</p>
      {permissions.canEditCRM && <button>Edit</button>}
    </div>
  );
}
```

## Files Created/Modified

### New Files

1. **`src/utils/permissions.ts`** - Permission definitions and utility functions
2. **`src/hooks/usePermissions.ts`** - React hooks for checking permissions
3. **`backend/scripts/create_employees_table.sql`** - SQL script to create employees table

### Modified Files

1. **`src/contexts/AuthContext.tsx`** - Updated to fetch and store employee role
2. **`src/components/ProtectedRoute.tsx`** - Already exists, uses authentication

## Authentication Flow

1. User signs in with email/password via Supabase Auth
2. System checks if email exists in `employees` table
3. If found, system fetches employee role and stores it in context
4. Permissions are calculated based on role
5. UI elements show/hide based on permissions
6. API calls can also check permissions (backend validation recommended)

## Next Steps

1. Run the SQL script to create the employees table
2. Add employees to the table with their roles
3. Ensure employee emails match Supabase Auth emails
4. Update UI components to use permission hooks where needed
5. Implement backend permission checks in API endpoints (recommended)

## Security Notes

- **Frontend permissions are for UX only** - Always validate permissions on the backend
- The employees table has Row Level Security (RLS) enabled
- Employees can only view their own record
- Consider adding admin endpoints to manage employees
- Never trust client-side permission checks for sensitive operations

