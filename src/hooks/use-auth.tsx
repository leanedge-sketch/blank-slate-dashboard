// Auth provider for the TanStack shell.
// TODO: REMOVE MOCK AUTH — set VITE_MOCK_AUTH=false (or remove) before production.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getMockAuthSnapshot, isMockAuthEnabled } from "@/lib/mock-auth";
import {
  getPermissionsForRole,
  type EmployeeRole,
  type Permissions,
} from "@/lib/permissions";

export { isMockAuthEnabled } from "@/lib/mock-auth";

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

function MockAuthProvider({ children }: { children: ReactNode }) {
  const mock = getMockAuthSnapshot();
  const value: AuthContextValue = {
    ...mock,
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    recheckEmployee: async () => {},
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isMockAuthEnabled) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus>("unknown");
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const checkingForRef = useRef<string | null>(null);

  const runEmployeeCheck = async (email: string) => {
    checkingForRef.current = email;
    setEmployeeStatus("checking");
    setEmployeeError(null);
    try {
      const result = await fetchEmployeeStatus(email);
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
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

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
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error(
          "Supabase is not configured. Add VITE_SUPABASE_* to .env or Lovable Secrets.",
        ),
      };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
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
