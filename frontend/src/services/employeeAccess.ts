import { supabase } from "../lib/supabase";
import {
  checkEmployeeStatus as checkEmployeeStatusAPI,
  verifyEmployeeWithSession,
  type EmployeeCheckResponse,
} from "./api";

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function rowMatchesEmail(rowEmail: string | null | undefined, target: string): boolean {
  return normalizeEmail(rowEmail ?? "") === target;
}

function toEmployeeResponse(row: {
  email: string;
  role: string | null;
  name?: string | null;
}): EmployeeCheckResponse {
  return {
    is_employee: true,
    email: row.email,
    role: row.role,
    name: row.name ?? null,
  };
}

/** Direct lookup via Supabase (uses the signed-in user's JWT + RLS). */
async function lookupEmployeeViaSupabase(
  email: string,
): Promise<EmployeeCheckResponse | null> {
  const normalized = normalizeEmail(email);

  const { data, error } = await supabase
    .from("employees")
    .select("email, role, name")
    .ilike("email", normalized)
    .limit(10);

  if (error) {
    console.warn("[employeeAccess] Supabase employees query failed:", error.message);
    return null;
  }

  const row = (data ?? []).find((r) => rowMatchesEmail(r.email, normalized));
  return row ? toEmployeeResponse(row) : null;
}

/**
 * Resolve employee status via API, then fall back to a direct Supabase read
 * when the API returns not found or is unreachable (common when SERVICE_KEY
 * is misconfigured but RLS allows self-read).
 */
export async function resolveEmployeeStatus(
  email: string,
): Promise<EmployeeCheckResponse> {
  const normalized = normalizeEmail(email);
  let apiResult: EmployeeCheckResponse | null = null;

  try {
    apiResult = await checkEmployeeStatusAPI(normalized);
    if (apiResult.is_employee) {
      return apiResult;
    }
  } catch (error) {
    console.warn("[employeeAccess] API check failed, trying fallbacks:", error);
  }

  try {
    const sessionResult = await verifyEmployeeWithSession();
    if (sessionResult.is_employee) {
      return sessionResult;
    }
    if (!apiResult) {
      apiResult = sessionResult;
    }
  } catch (error) {
    console.warn("[employeeAccess] Session verify failed, trying Supabase:", error);
  }

  const direct = await lookupEmployeeViaSupabase(normalized);
  if (direct) {
    return direct;
  }

  return (
    apiResult ?? {
      is_employee: false,
      email: normalized,
      role: null,
      name: null,
    }
  );
}
