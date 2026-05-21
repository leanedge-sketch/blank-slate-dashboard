import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { EmployeeRole, getPermissionsForRole } from "../utils/permissions";
import { checkEmployeeStatus as checkEmployeeStatusAPI } from "../services/api";
import { CANONICAL_PRODUCTION_URL } from "../lib/canonical-host";
import {
  createDevMockSession,
  createDevMockUser,
  DEV_MOCK_EMAIL,
  DEV_MOCK_NAME,
  DEV_MOCK_ROLE,
  isDevMockAuthAvailable,
  isDevMockSessionActive,
  persistDevMockSession,
} from "../lib/dev-mock-auth";

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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  checkPasswordSet: () => boolean;
  signOut: () => Promise<void>;
  signInDevMock: () => Promise<void>;
  isDevMockSession: boolean;
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
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole | null>(null);
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null);
  const [isDevMockSession, setIsDevMockSession] = useState(false);

  const applyDevMockSession = () => {
    const mockUser = createDevMockUser();
    setUser(mockUser);
    setSession(createDevMockSession(mockUser));
    setIsEmployee(true);
    setEmployeeRole(DEV_MOCK_ROLE);
    setEmployeeData({
      email: DEV_MOCK_EMAIL,
      role: DEV_MOCK_ROLE,
      name: DEV_MOCK_NAME,
    });
    setIsDevMockSession(true);
    persistDevMockSession(true);
    setLoading(false);
  };

  const clearDevMockSession = () => {
    setIsDevMockSession(false);
    persistDevMockSession(false);
  };

  // Check if user email exists in employees table and get role
  // Uses backend API instead of direct Supabase query for better reliability
  const checkEmployeeStatus = async (email: string): Promise<EmployeeData | null> => {
    const normalizedEmail = email.toLowerCase().trim();
    console.log("🔍 Checking employee status for email:", normalizedEmail);
    
    try {
      // Use backend API endpoint - more reliable and bypasses RLS issues
      const result = await checkEmployeeStatusAPI(normalizedEmail);
      
      if (result.is_employee && result.role) {
        console.log("✅ Employee found:", result);
        return {
          email: result.email,
          role: result.role as EmployeeRole,
          name: result.name || undefined,
        };
      }

      console.log("❌ No employee found for email:", normalizedEmail);
      return null;
    } catch (error) {
      console.error("❌ Exception checking employee status:", error);
      if (error instanceof Error) {
        console.error("Exception message:", error.message);
        console.error("Exception stack:", error.stack);
      }
      return null;
    }
  };

  useEffect(() => {
    if (isDevMockAuthAvailable() && isDevMockSessionActive()) {
      applyDevMockSession();
      return;
    }

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        const employeeInfo = await checkEmployeeStatus(session.user.email);
        if (employeeInfo) {
          setIsEmployee(true);
          setEmployeeRole(employeeInfo.role);
          setEmployeeData(employeeInfo);
        } else {
          // Don't auto-sign out on employee check failure - might be network error
          // Let the user see an error message instead
          console.warn("⚠️ Employee check failed - user may not be registered or API error");
          setIsEmployee(false);
          setEmployeeRole(null);
          setEmployeeData(null);
          // Don't sign out immediately - might be a temporary network issue
        }
      } else {
        setIsEmployee(false);
        setEmployeeRole(null);
        setEmployeeData(null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        const employeeInfo = await checkEmployeeStatus(session.user.email);
        if (employeeInfo) {
          setIsEmployee(true);
          setEmployeeRole(employeeInfo.role);
          setEmployeeData(employeeInfo);
        } else {
          // Don't auto-sign out on employee check failure - might be network error
          // Let the user see an error message instead
          console.warn("⚠️ Employee check failed - user may not be registered or API error");
          setIsEmployee(false);
          setEmployeeRole(null);
          setEmployeeData(null);
          // Don't sign out immediately - might be a temporary network issue
        }
      } else {
        setIsEmployee(false);
        setEmployeeRole(null);
        setEmployeeData(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
        const employeeInfo = await checkEmployeeStatus(data.user.email);
        if (!employeeInfo) {
          // Sign out if not an employee
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
      const employeeInfo = await checkEmployeeStatus(email);
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
      const employeeInfo = await checkEmployeeStatus(email);
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

  const signInDevMock = async () => {
    if (!isDevMockAuthAvailable()) {
      throw new Error("Dev mock login is only available in local development.");
    }
    applyDevMockSession();
  };

  const signOut = async () => {
    if (isDevMockSession) {
      clearDevMockSession();
      setUser(null);
      setSession(null);
      setIsEmployee(false);
      setEmployeeRole(null);
      setEmployeeData(null);
      return;
    }
    if (!isSupabaseConfigured()) {
      return;
    }
    await supabase.auth.signOut();
    setIsEmployee(false);
    setEmployeeRole(null);
    setEmployeeData(null);
  };

  const permissions = getPermissionsForRole(employeeRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signInWithMagicLink,
        resetPassword,
        updatePassword,
        checkPasswordSet,
        signOut,
        signInDevMock,
        isDevMockSession,
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

