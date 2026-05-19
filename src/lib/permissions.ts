/**
 * Role-Based Access Control (RBAC) Permissions
 * 
 * Defines what each role can view and edit in the LeanChem Connect system.
 */

export type EmployeeRole =
  | "admin"
  | "product manager"
  | "sales and stock"
  | "sales"
  | "logistic";

export interface Permissions {
  // View permissions
  canViewCRM: boolean;
  canViewPMS: boolean;
  canViewSalesPipeline: boolean;
  canViewStock: boolean;

  // Edit permissions
  canEditCRM: boolean;
  canEditPMS: boolean;
  canEditSalesPipeline: boolean;
  canEditStock: boolean;
}

/**
 * Get permissions for a given role
 */
export function getPermissionsForRole(role: EmployeeRole | null): Permissions {
  if (!role) {
    return {
      canViewCRM: false,
      canViewPMS: false,
      canViewSalesPipeline: false,
      canViewStock: false,
      canEditCRM: false,
      canEditPMS: false,
      canEditSalesPipeline: false,
      canEditStock: false,
    };
  }

  switch (role.toLowerCase()) {
    case "admin":
      return {
        canViewCRM: true,
        canViewPMS: true,
        canViewSalesPipeline: true,
        canViewStock: true,
        canEditCRM: true,
        canEditPMS: true,
        canEditSalesPipeline: true,
        canEditStock: true,
      };

    case "product manager":
      return {
        canViewCRM: true,
        canViewPMS: true,
        canViewSalesPipeline: true,
        canViewStock: true,
        canEditCRM: false,
        canEditPMS: true,
        canEditSalesPipeline: false,
        canEditStock: false,
      };

    case "sales and stock":
      return {
        canViewCRM: true,
        canViewPMS: true,
        canViewSalesPipeline: true,
        canViewStock: true,
        canEditCRM: true,
        canEditPMS: false,
        canEditSalesPipeline: true,
        canEditStock: true,
      };

    case "sales":
      return {
        canViewCRM: true,
        canViewPMS: true,
        canViewSalesPipeline: true,
        canViewStock: true,
        canEditCRM: true,
        canEditPMS: false,
        canEditSalesPipeline: true,
        canEditStock: false,
      };

    case "logistic":
      return {
        canViewCRM: true,
        canViewPMS: true,
        canViewSalesPipeline: true,
        canViewStock: true,
        canEditCRM: false,
        canEditPMS: true,
        canEditSalesPipeline: false,
        canEditStock: false,
      };

    default:
      // Default: no permissions
      return {
        canViewCRM: false,
        canViewPMS: false,
        canViewSalesPipeline: false,
        canViewStock: false,
        canEditCRM: false,
        canEditPMS: false,
        canEditSalesPipeline: false,
        canEditStock: false,
      };
  }
}

/**
 * Check if a role has permission to view a specific section
 */
export function canViewSection(
  role: EmployeeRole | null,
  section: "crm" | "pms" | "sales" | "stock"
): boolean {
  const permissions = getPermissionsForRole(role);
  switch (section) {
    case "crm":
      return permissions.canViewCRM;
    case "pms":
      return permissions.canViewPMS;
    case "sales":
      return permissions.canViewSalesPipeline;
    case "stock":
      return permissions.canViewStock;
    default:
      return false;
  }
}

/**
 * Check if a role has permission to edit a specific section
 */
export function canEditSection(
  role: EmployeeRole | null,
  section: "crm" | "pms" | "sales" | "stock"
): boolean {
  const permissions = getPermissionsForRole(role);
  switch (section) {
    case "crm":
      return permissions.canEditCRM;
    case "pms":
      return permissions.canEditPMS;
    case "sales":
      return permissions.canEditSalesPipeline;
    case "stock":
      return permissions.canEditStock;
    default:
      return false;
  }
}

