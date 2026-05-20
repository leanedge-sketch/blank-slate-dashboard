// TODO: REMOVE MOCK AUTH FOR PRODUCTION
// Auth is currently mocked for the stakeholder demo. Real Supabase + employee
// gate logic has been short-circuited so the published preview opens straight
// into the dashboard without requiring sign-in.
import { createContext, useContext, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import {
  getPermissionsForRole,
  type EmployeeRole,
  type Permissions,
} from "@/lib/permissions";

export type EmployeeStatus = "unknown" | "checking" | "active" | "denied" | "error";

interface EmployeeData {
  email: string;
  role: EmployeeRole;
  name: string | null;
  company?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  employee: EmployeeData | null;
  employeeRole: EmployeeRole | null;
  employeeStatus: EmployeeStatus;
  employeeError: string | null;
  isAuthorized: boolean;
  permissions: Permissions;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  recheckEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// TODO: REMOVE MOCK AUTH FOR PRODUCTION
const MOCK_USER = {
  id: "demo-user-0001",
  email: "demo@leanchem.com",
  app_metadata: { provider: "demo" },
  user_metadata: {
    full_name: "Alex Morgan",
    company: "LeanChem",
    role: "Project Manager",
  },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

const MOCK_SESSION = {
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: MOCK_USER,
} as unknown as Session;

const MOCK_EMPLOYEE: EmployeeData = {
  email: "demo@leanchem.com",
  // Map "Project Manager" → existing "product manager" RBAC role so permissions resolve cleanly.
  role: "product manager",
  name: "Alex Morgan",
  company: "LeanChem",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // TODO: REMOVE MOCK AUTH FOR PRODUCTION
  const value: AuthContextValue = {
    user: MOCK_USER,
    session: MOCK_SESSION,
    loading: false,
    employee: MOCK_EMPLOYEE,
    employeeRole: MOCK_EMPLOYEE.role,
    employeeStatus: "active",
    employeeError: null,
    isAuthorized: true,
    permissions: getPermissionsForRole(MOCK_EMPLOYEE.role),
    signIn: async () => ({ error: null }),
    signOut: async () => {
      /* no-op while mocked */
    },
    recheckEmployee: async () => {
      /* no-op while mocked */
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
