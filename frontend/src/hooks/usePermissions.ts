import { useAuth } from "../contexts/AuthContext";
import { canEditSection, Permissions } from "../utils/permissions";

export { useCanView } from "../contexts/AuthContext";

export function useCanEdit(section: "crm" | "pms" | "sales" | "stock"): boolean {
  const { employeeRole } = useAuth();
  return canEditSection(employeeRole, section);
}

export function usePermissions(): Permissions {
  const { permissions } = useAuth();
  return permissions;
}
