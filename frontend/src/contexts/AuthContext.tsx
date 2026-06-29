import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { User, Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { EmployeeRole, getPermissionsForRole } from "../utils/permissions";
import { resolveEmployeeStatus } from "../services/employeeAccess";
import { CANONICAL_PRODUCTION_URL } from "../lib/canonical-host";
import { isRequestAborted } from "../lib/request-errors";

/** Auth events that require a fresh employees-table lookup. */
const EMPLOYEE_CHECK_EVENTS = new Set<AuthChangeEvent>([
  "INITIAL_SESSION",
  "SIGNED_IN",
]);

/** Refresh/session churn — never block the UI or revoke access. */
const EMPLOYEE_CHECK_SKIP_EVENTS = new Set<AuthChangeEvent>([
  "TOKEN_REFRESHED",
]);

const EMPLOYEE_CHECK_TIMEOUT_MS = 8_000;
const EMPLOYEE_CHECK_RETRY_ATTEMPTS = 3;
const EMPLOYEE_CHECK_RETRY_DELAY_MS = 500;
const EMPLOYEE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EMPLOYEE_CACHE_KEY = "leanchem_employee_verification";

type EmployeeCheckOutcome =
  | { kind: "employee"; data: EmployeeData }
  | { kind: "not_employee" }
  | { kind: "failed" }
  | { kind: "stale" };

interface CachedEmployeeVerification {
  email: string;
  role: EmployeeRole;
  name?: string;
  verifiedAt: number;
}

function readEmployeeCache(email: string): CachedEmployeeVerification | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(EMPLOYEE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEmployeeVerification;
    if (parsed.email !== email.toLowerCase().trim()) return null;
    if (Date.now() - parsed.verifiedAt > EMPLOYEE_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEmployeeCache(data: EmployeeData): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedEmployeeVerification = {
      email: data.email.toLowerCase().trim(),
      role: data.role,
      name: data.name,
      verifiedAt: Date.now(),
    };
    sessionStorage.setItem(EMPLOYEE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function clearEmployeeCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(EMPLOYEE_CACHE_KEY);
  } catch {
    // ignore
  }
}

function employeeDataFromCache(
  cached: CachedEmployeeVerification,
): EmployeeData {
  return {
    email: cached.email,
    role: cached.role,
    name: cached.name,
  };
}

/** Canonical production URL (Vercel production alias). */
export const PRODUCTION_APP_URL = CANONICAL_PRODUCTION_URL;

function authRedirectBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return import.meta.env.VITE_FRONTEND_URL?.trim() || PRODUCTION_APP_URL;
}

// Debug log to verify which URL is being used
if (typeof window !== 'undefined') {
  const redirectBase = authRedirectBaseUrl();
  console.log('🔗 Auth redirect base URL:', redirectBase);
  console.log('🔗 VITE_FRONTEND_URL env var:', import.meta.env.VITE_FRONTEND_URL);
  console.log('🔗 window.location.origin:', window.location.origin);
}

interface EmployeeData {
  email: string;
  role: EmployeeRole;
  name?: string;
}

type EmployeeLookupResult =
  | { status: "found"; employee: EmployeeData }
  | { status: "not_found" }
  | { status: "error" }
  | { status: "stale" };

function outcomeToLookup(outcome: EmployeeCheckOutcome): EmployeeLookupResult {
  if (outcome.kind === "employee") {
    return { status: "found", employee: outcome.data };
  }
  if (outcome.kind === "not_employee") {
    return { status: "not_found" };
  }
  if (outcome.kind === "stale") {
    return { status: "stale" };
  }
  return { status: "error" };
}

/** Grant access to any signed-in Supabase Auth user (invite-only auth). */
function employeeFromAuthenticatedUser(authUser: User): EmployeeData {
  const email = authUser.email!.toLowerCase().trim();
  const meta = authUser.user_metadata ?? {};
  const app = authUser.app_metadata ?? {};
  const rawRole =
    (typeof meta.role === "string" && meta.role) ||
    (typeof app.role === "string" && app.role) ||
    "sales";
  const role = rawRole.trim().toLowerCase() as EmployeeRole;
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    undefined;
  return { email, role, name };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** True while verifying the signed-in user against the employees table. */
  employeeLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  checkPasswordSet: () => boolean;
  signOut: () => Promise<void>;
  /** Re-run employees table check (e.g. after admin adds your email). */
  recheckEmployeeAccess: () => Promise<void>;
  isEmployee: boolean;
  employeeRole: EmployeeRole | null;
  employeeData: EmployeeData | null;
  permissions: ReturnType<typeof getPermissionsForRole>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const employeeCheckGeneration = useRef(0);
  const lastEmployeeEmail = useRef<string | null>(null);
  const verifiedEmployeeRef = useRef<EmployeeData | null>(null);

  const applyVerifiedEmployee = (employeeInfo: EmployeeData) => {
    verifiedEmployeeRef.current = employeeInfo;
    lastEmployeeEmail.current = employeeInfo.email.toLowerCase().trim();
    setIsEmployee(true);
    setEmployeeRole(employeeInfo.role);
    setEmployeeData(employeeInfo);
    writeEmployeeCache(employeeInfo);
  };

  const clearVerifiedEmployee = () => {
    verifiedEmployeeRef.current = null;
    lastEmployeeEmail.current = null;
    setIsEmployee(false);
    setEmployeeRole(null);
    setEmployeeData(null);
    clearEmployeeCache();
  };

  const checkEmployeeStatusOnce = async (
    email: string,
    generation: number,
  ): Promise<EmployeeCheckOutcome> => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await Promise.race([
        resolveEmployeeStatus(normalizedEmail),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Employee check timed out")),
            EMPLOYEE_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      if (generation !== employeeCheckGeneration.current) {
        return { kind: "stale" };
      }

      if (result.is_employee) {
        const role = (result.role?.trim().toLowerCase() ||
          "sales") as EmployeeRole;
        return {
          kind: "employee",
          data: {
            email: result.email,
            role,
            name: result.name || undefined,
          },
        };
      }

      return { kind: "not_employee" };
    } catch (error) {
      if (isRequestAborted(error) || generation !== employeeCheckGeneration.current) {
        return { kind: "stale" };
      }
      console.error("Employee status check failed:", error);
      return { kind: "failed" };
    }
  };

  // Retries transient API/network failures — only deny on explicit not_employee.
  const checkEmployeeStatus = async (
    email: string,
    generation: number,
  ): Promise<EmployeeCheckOutcome> => {
    for (let attempt = 0; attempt < EMPLOYEE_CHECK_RETRY_ATTEMPTS; attempt++) {
      const outcome = await checkEmployeeStatusOnce(email, generation);
      if (outcome.kind === "stale") return outcome;
      if (outcome.kind === "employee" || outcome.kind === "not_employee") {
        return outcome;
      }
      if (attempt < EMPLOYEE_CHECK_RETRY_ATTEMPTS - 1) {
        await new Promise((resolve) => {
          window.setTimeout(
            resolve,
            EMPLOYEE_CHECK_RETRY_DELAY_MS * (attempt + 1),
          );
        });
      }
    }
    return { kind: "failed" };
  };

  const lookupEmployee = async (
    email: string,
    generation: number,
  ): Promise<EmployeeLookupResult> => {
    return outcomeToLookup(await checkEmployeeStatus(email, generation));
  };

  const hydrateEmployeeFromCache = (email: string): boolean => {
    const normalized = email.toLowerCase().trim();
    const cached = readEmployeeCache(normalized);
    if (!cached) return false;
    applyVerifiedEmployee(employeeDataFromCache(cached));
    return true;
  };

  const applyEmployeeFromSession = async (
    email: string | undefined | null,
    authUser: User | null | undefined,
    event: AuthChangeEvent,
    generation: number,
    options?: { background?: boolean },
  ) => {
    if (!email) {
      clearVerifiedEmployee();
      return;
    }

    const normalized = email.toLowerCase().trim();

    if (
      lastEmployeeEmail.current === normalized &&
      verifiedEmployeeRef.current
    ) {
      return;
    }

    const outcome = await checkEmployeeStatus(normalized, generation);
    if (generation !== employeeCheckGeneration.current) {
      return;
    }

    if (outcome.kind === "employee") {
      applyVerifiedEmployee(outcome.data);
      return;
    }

    if (outcome.kind === "stale") {
      return;
    }

    const cached = readEmployeeCache(normalized);
    if (cached) {
      applyVerifiedEmployee(employeeDataFromCache(cached));
      if (!options?.background) {
        console.warn(
          "Employee API check failed; using cached verification for",
          normalized,
        );
      }
      return;
    }

    if (
      outcome.kind === "failed" &&
      lastEmployeeEmail.current === normalized &&
      verifiedEmployeeRef.current
    ) {
      console.warn(
        "Employee re-check failed; keeping prior verification for",
        normalized,
      );
      return;
    }

    if (outcome.kind === "not_employee") {
      if (authUser?.email) {
        applyVerifiedEmployee(employeeFromAuthenticatedUser(authUser));
        return;
      }
      clearVerifiedEmployee();
      return;
    }

    if (outcome.kind === "failed") {
      console.warn(
        "Employee check failed after retries — network or API may be unavailable",
      );
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Keep callback synchronous — async work here causes Supabase auth lock AbortErrors.
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      const email = session?.user?.email;
      if (!email) {
        clearVerifiedEmployee();
        setEmployeeLoading(false);
        return;
      }

      const normalized = email.toLowerCase().trim();

      if (EMPLOYEE_CHECK_SKIP_EVENTS.has(event)) {
        return;
      }

      const alreadyVerified =
        lastEmployeeEmail.current === normalized && verifiedEmployeeRef.current;

      if (alreadyVerified) {
        return;
      }

      const generation = ++employeeCheckGeneration.current;
      const useCacheWhileLoading =
        EMPLOYEE_CHECK_EVENTS.has(event) && hydrateEmployeeFromCache(normalized);
      const blockUi = !useCacheWhileLoading && !alreadyVerified;

      if (blockUi) {
        setEmployeeLoading(true);
      }

      void applyEmployeeFromSession(email, session?.user ?? null, event, generation, {
        background: useCacheWhileLoading || alreadyVerified,
      })
        .catch((err) => {
          if (!isRequestAborted(err)) {
            console.error("Employee status check failed:", err);
          }
          if (
            EMPLOYEE_CHECK_EVENTS.has(event) &&
            !verifiedEmployeeRef.current
          ) {
            hydrateEmployeeFromCache(normalized);
          }
        })
        .finally(() => {
          if (generation === employeeCheckGeneration.current) {
            setEmployeeLoading(false);
          }
        });
    });

    return () => {
      employeeCheckGeneration.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error(
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_*) on Vercel, then redeploy.",
        ),
      };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Employee verification runs once via onAuthStateChange (SIGNED_IN).
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithMagicLink = async (email: string) => {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error(
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_*) on Vercel, then redeploy.",
        ),
      };
    }

    try {
      // First check if email is an employee
      const generation = ++employeeCheckGeneration.current;
      const lookup = await lookupEmployee(email, generation);
      if (lookup.status === "not_found" || lookup.status === "stale") {
        return {
          error: new Error(
            "Access denied. Your email is not registered as an employee."
          ),
        };
      }
      if (lookup.status === "error") {
        return {
          error: new Error(
            "Could not verify employee status. Check your connection and try again."
          ),
        };
      }

      // Send magic link for first-time users (password not set yet)
      // This will create the user if they don't exist
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${authRedirectBaseUrl()}/auth/callback?type=setup`,
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error(
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_*) on Vercel, then redeploy.",
        ),
      };
    }

    try {
      // First check if email is an employee
      const generation = ++employeeCheckGeneration.current;
      const lookup = await lookupEmployee(email, generation);
      if (lookup.status === "not_found" || lookup.status === "stale") {
        return {
          error: new Error(
            "Access denied. Your email is not registered as an employee."
          ),
        };
      }
      if (lookup.status === "error") {
        return {
          error: new Error(
            "Could not verify employee status. Check your connection and try again."
          ),
        };
      }

      // Send password reset email
      const redirectUrl = `${authRedirectBaseUrl()}/auth/callback?type=reset`;
      console.log('📧 Sending password reset email with redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!isSupabaseConfigured()) {
      return {
        error: new Error(
          "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY (or VITE_SUPABASE_*) on Vercel, then redeploy.",
        ),
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          password_set: true, // Mark that password has been set
          password_set_at: new Date().toISOString(),
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const checkPasswordSet = (): boolean => {
    // Check if user has set a password by checking user metadata
    if (!user) return false;
    return user.user_metadata?.password_set === true || user.app_metadata?.password_set === true;
  };

  const recheckEmployeeAccess = async () => {
    const email = user?.email;
    if (!email) return;

    const normalized = email.toLowerCase().trim();
    const generation = ++employeeCheckGeneration.current;
    setEmployeeLoading(true);
    try {
      const lookup = await lookupEmployee(normalized, generation);
      if (generation !== employeeCheckGeneration.current) return;
      if (lookup.status === "found") {
        applyVerifiedEmployee(lookup.employee);
        return;
      }
      if (lookup.status === "not_found" && user) {
        applyVerifiedEmployee(employeeFromAuthenticatedUser(user));
        return;
      }
      const cached = readEmployeeCache(normalized);
      if (cached) {
        applyVerifiedEmployee(employeeDataFromCache(cached));
        return;
      }
      if (
        lastEmployeeEmail.current === normalized &&
        verifiedEmployeeRef.current
      ) {
        return;
      }
    } finally {
      if (generation === employeeCheckGeneration.current) {
        setEmployeeLoading(false);
      }
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    await supabase.auth.signOut();
    clearVerifiedEmployee();
    setEmployeeLoading(false);
  };

  const permissions = getPermissionsForRole(employeeRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        employeeLoading,
        signIn,
        signInWithMagicLink,
        resetPassword,
        updatePassword,
        checkPasswordSet,
        signOut,
        recheckEmployeeAccess,
        isEmployee,
        employeeRole,
        employeeData,
        permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

