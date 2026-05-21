import type { Session, User } from "@supabase/supabase-js";
import type { EmployeeRole } from "../utils/permissions";

export const DEV_MOCK_STORAGE_KEY = "leanchem-dev-mock-auth";

export const DEV_MOCK_EMAIL = "dev@leanchem.local";
export const DEV_MOCK_NAME = "Dev User";
export const DEV_MOCK_ROLE: EmployeeRole = "admin";

/** Dev-only bypass; never enabled in production builds. */
export function isDevMockAuthAvailable(): boolean {
  return import.meta.env.DEV;
}

export function isDevMockSessionActive(): boolean {
  if (!isDevMockAuthAvailable()) return false;
  try {
    return localStorage.getItem(DEV_MOCK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistDevMockSession(active: boolean): void {
  if (!isDevMockAuthAvailable()) return;
  try {
    if (active) {
      localStorage.setItem(DEV_MOCK_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(DEV_MOCK_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function createDevMockUser(): User {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: DEV_MOCK_EMAIL,
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: "dev-mock", providers: ["dev-mock"] },
    user_metadata: {
      full_name: DEV_MOCK_NAME,
      password_set: true,
      dev_mock: true,
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User;
}

export function createDevMockSession(user: User): Session {
  return {
    access_token: "dev-mock-token",
    refresh_token: "dev-mock-refresh",
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    token_type: "bearer",
    user,
  } as Session;
}
