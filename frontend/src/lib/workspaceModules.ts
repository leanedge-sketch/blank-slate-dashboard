export type WorkspaceModuleKey =
  | "crm"
  | "pms"
  | "sales"
  | "stock"
  | "reports"
  | "finance"
  | "rfqs"
  | "logistics";

export const MODULE_ACCESS_HINT: Record<WorkspaceModuleKey, string> = {
  crm: "Requires CRM permissions",
  pms: "Requires Product Management permissions",
  sales: "Requires Sales Pipeline permissions",
  stock: "Requires Stock permissions",
  reports: "Requires CRM / reporting permissions",
  finance: "Requires Finance & Procurement permissions",
  rfqs: "Requires Sales permissions",
  logistics: "Requires Sales or Procurement permissions",
};
