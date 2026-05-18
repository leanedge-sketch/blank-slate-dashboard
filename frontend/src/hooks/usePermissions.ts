import { useAuth } from "../contexts/AuthContext";
import { canViewSection, canEditSection, Permissions } from "../utils/permissions";

/**
 * Hook to check if current user can view a specific section
 */
export function useCanView(section: "crm" | "pms" | "sales" | "stock"): boolean {
  const { employeeRole } = useAuth();
  return canViewSection(employeeRole, section);
}

/**
 * Hook to check if current user can edit a specific section
 */
export function useCanEdit(section: "crm" | "pms" | "sales" | "stock"): boolean {
  const { employeeRole } = useAuth();
  return canEditSection(employeeRole, section);
}

/**
 * Hook to get all permissions for current user
 */
export function usePermissions(): Permissions {
  const { permissions } = useAuth();
  return permissions;
}

