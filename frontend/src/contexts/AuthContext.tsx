import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { EmployeeRole, getPermissionsForRole } from "../utils/permissions";
import { checkEmployeeStatus as checkEmployeeStatusAPI } from "../services/api";

// Frontend base URL for auth redirects (magic links, password reset, etc.)
// In production, set VITE_FRONTEND_URL to your Vercel URL.
// In development, it will fall back to window.location.origin.
// IMPORTANT: VITE_FRONTEND_URL must be set in Vercel environment variables for production!
const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL?.trim() || window.location.origin;

// Debug log to verify which URL is being used
if (typeof window !== 'undefined') {
  console.log('🔗 Frontend URL for auth redirects:', FRONTEND_URL);
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
          emailRedirectTo: `${FRONTEND_URL}/auth/callback?type=setup`,
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
      const redirectUrl = `${FRONTEND_URL}/auth/callback?type=reset`;
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

