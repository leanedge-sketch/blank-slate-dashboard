// Auth provider for the new TanStack shell.
// Wraps Supabase Auth + the existing FastAPI `/auth/check-employee` gate so
// only active employees reach the app. Role-based permissions are derived
// via the same matrix the legacy `frontend/` app uses.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
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
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // Employee gate
  employee: EmployeeData | null;
  employeeRole: EmployeeRole | null;
  employeeStatus: EmployeeStatus;
  employeeError: string | null;
  isAuthorized: boolean; // signed in AND active employee
  permissions: Permissions;
  // Actions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  recheckEmployee: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// FastAPI base URL — same convention as frontend/src/services/api.ts
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:8000/api/v1";

interface EmployeeCheckResponse {
  is_employee: boolean;
  email: string;
  role: string | null;
  name: string | null;
}

async function fetchEmployeeStatus(email: string): Promise<EmployeeCheckResponse> {
  const url = new URL(`${API_BASE_URL}/auth/check-employee`);
  url.searchParams.set("email", email);
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Employee check failed (${res.status})`);
  }
  return (await res.json()) as EmployeeCheckResponse;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>("unknown");
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Track the latest email we kicked a check for, so stale resolves are ignored.
  const checkingForRef = useRef<string | null>(null);

  const runEmployeeCheck = async (email: string) => {
    checkingForRef.current = email;
    setEmployeeStatus("checking");
    setEmployeeError(null);
    try {
      const result = await fetchEmployeeStatus(email);
      // Ignore if a newer check has started (user switched accounts).
      if (checkingForRef.current !== email) return;

      if (result.is_employee && result.role) {
        setEmployee({
          email: result.email,
          role: result.role.toLowerCase() as EmployeeRole,
          name: result.name,
        });
        setEmployeeStatus("active");
      } else {
        setEmployee(null);
        setEmployeeStatus("denied");
      }
    } catch (err) {
      if (checkingForRef.current !== email) return;
      console.error("[auth] employee check failed:", err);
      setEmployee(null);
      setEmployeeStatus("error");
      setEmployeeError(
        err instanceof Error ? err.message : "Failed to verify employee status",
      );
    }
  };

  const resetEmployeeState = () => {
    checkingForRef.current = null;
    setEmployee(null);
    setEmployeeStatus("unknown");
    setEmployeeError(null);
  };

  useEffect(() => {
    const handleSession = async (next: Session | null) => {
      setSession(next);
      setLoading(false);
      const email = next?.user?.email;
      if (email) {
        await runEmployeeCheck(email);
      } else {
        resetEmployeeState();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void handleSession(next);
    });

    supabase.auth.getSession().then(({ data }) => {
      void handleSession(data.session);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetEmployeeState();
  };

  const recheckEmployee = async () => {
    const email = session?.user?.email;
    if (email) await runEmployeeCheck(email);
  };

  const user = session?.user ?? null;
  const employeeRole = employee?.role ?? null;
  const permissions = getPermissionsForRole(employeeRole);
  const isAuthorized = Boolean(user) && employeeStatus === "active";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        employee,
        employeeRole,
        employeeStatus,
        employeeError,
        isAuthorized,
        permissions,
        signIn,
        signOut,
        recheckEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
