// TODO: REMOVE MOCK AUTH — delete this file and revert use-auth.tsx / __root.tsx before production.
import type { Session, User } from "@supabase/supabase-js";

import {
  getPermissionsForRole,
  type EmployeeRole,
  type Permissions,
} from "@/lib/permissions";

/** Local dev default, or Lovable demo when VITE_MOCK_AUTH=true in Secrets. */
export const isMockAuthEnabled =
  import.meta.env.VITE_MOCK_AUTH === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_MOCK_AUTH !== "false");

const MOCK_EMAIL = "demo@leanchem.com";
const MOCK_ROLE: EmployeeRole = "admin";

const MOCK_USER = {
  id: "demo-user-0001",
  aud: "authenticated",
  role: "authenticated",
  email: MOCK_EMAIL,
  email_confirmed_at: new Date().toISOString(),
  phone: "",
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: { provider: "mock", providers: ["mock"] },
  user_metadata: {
    full_name: "Alex Morgan (demo)",
    company: "LeanChem",
    role: "Admin",
  },
  identities: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
} as User;

const MOCK_SESSION = {
  access_token: "mock-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: MOCK_USER,
} as Session;

export interface MockAuthSnapshot {
  user: User;
  session: Session;
  employee: { email: string; role: EmployeeRole; name: string; company?: string };
  employeeRole: EmployeeRole;
  employeeStatus: "active";
  employeeError: null;
  isAuthorized: true;
  permissions: Permissions;
  loading: false;
}

export function getMockAuthSnapshot(): MockAuthSnapshot {
  const employee = {
    email: MOCK_EMAIL,
    role: MOCK_ROLE,
    name: "Alex Morgan",
    company: "LeanChem",
  };
  return {
    user: MOCK_USER,
    session: MOCK_SESSION,
    employee,
    employeeRole: MOCK_ROLE,
    employeeStatus: "active",
    employeeError: null,
    isAuthorized: true,
    permissions: getPermissionsForRole(MOCK_ROLE),
    loading: false,
  };
}
