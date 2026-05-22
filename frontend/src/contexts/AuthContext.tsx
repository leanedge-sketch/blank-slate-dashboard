import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { User, Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { EmployeeRole, getPermissionsForRole } from "../utils/permissions";
import { checkEmployeeStatus as checkEmployeeStatusAPI } from "../services/api";
import { CANONICAL_PRODUCTION_URL } from "../lib/canonical-host";
import { isRequestAborted } from "../lib/request-errors";

const EMPLOYEE_CHECK_EVENTS = new Set<AuthChangeEvent>([
  "INITIAL_SESSION",
  "SIGNED_IN",
  "USER_UPDATED",
  "PASSWORD_RECOVERY",
]);

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

  // Check if user email exists in employees table and get role
  // Uses backend API instead of direct Supabase query for better reliability
  const checkEmployeeStatus = async (
    email: string,
    generation: number,
  ): Promise<EmployeeData | null> => {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const result = await checkEmployeeStatusAPI(normalizedEmail);
      if (generation !== employeeCheckGeneration.current) {
        return null;
      }

      if (result.is_employee && result.role) {
        return {
          email: result.email,
          role: result.role as EmployeeRole,
          name: result.name || undefined,
        };
      }

      return null;
    } catch (error) {
      if (isRequestAborted(error) || generation !== employeeCheckGeneration.current) {
        return null;
      }
      console.error("Employee status check failed:", error);
      return null;
    }
  };

  const applyEmployeeFromSession = async (
    email: string | undefined | null,
    event: AuthChangeEvent,
  ) => {
    if (!email) {
      setIsEmployee(false);
      setEmployeeRole(null);
      setEmployeeData(null);
      lastEmployeeEmail.current = null;
      setEmployeeLoading(false);
      return;
    }

    const normalized = email.toLowerCase().trim();
    if (
      !EMPLOYEE_CHECK_EVENTS.has(event) &&
      lastEmployeeEmail.current === normalized
    ) {
      return;
    }

    const generation = ++employeeCheckGeneration.current;
    const employeeInfo = await checkEmployeeStatus(normalized, generation);
    if (generation !== employeeCheckGeneration.current) {
      return;
    }

    lastEmployeeEmail.current = normalized;
    if (employeeInfo) {
      setIsEmployee(true);
      setEmployeeRole(employeeInfo.role);
      setEmployeeData(employeeInfo);
    } else {
      console.warn(
        "Employee check failed — user may not be registered or API error",
      );
      setIsEmployee(false);
      setEmployeeRole(null);
      setEmployeeData(null);
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
        setIsEmployee(false);
        setEmployeeRole(null);
        setEmployeeData(null);
        lastEmployeeEmail.current = null;
        setEmployeeLoading(false);
        return;
      }

      const generation = ++employeeCheckGeneration.current;
      setEmployeeLoading(true);
      void applyEmployeeFromSession(email, event)
        .catch((err) => {
          if (!isRequestAborted(err)) {
            console.error("Employee status check failed:", err);
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      // Check if user is an employee
      if (data.user?.email) {
        setEmployeeLoading(true);
        const generation = ++employeeCheckGeneration.current;
        try {
          const employeeInfo = await checkEmployeeStatus(
            data.user.email,
            generation,
          );
          if (!employeeInfo) {
            await supabase.auth.signOut();
            return {
              error: new Error(
                "Access denied. Your email is not registered as an employee."
              ),
            };
          }
          setIsEmployee(true);
          setEmployeeRole(employeeInfo.role);
          setEmployeeData(employeeInfo);
          lastEmployeeEmail.current = data.user.email.toLowerCase().trim();
        } finally {
          if (generation === employeeCheckGeneration.current) {
            setEmployeeLoading(false);
          }
        }
      }

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
      const employeeInfo = await checkEmployeeStatus(email, generation);
      if (!employeeInfo) {
        return {
          error: new Error(
            "Access denied. Your email is not registered as an employee."
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
      const employeeInfo = await checkEmployeeStatus(email, generation);
      if (!employeeInfo) {
        return {
          error: new Error(
            "Access denied. Your email is not registered as an employee."
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

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      return;
    }
    await supabase.auth.signOut();
    setIsEmployee(false);
    setEmployeeRole(null);
    setEmployeeData(null);
    setEmployeeLoading(false);
    lastEmployeeEmail.current = null;
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

