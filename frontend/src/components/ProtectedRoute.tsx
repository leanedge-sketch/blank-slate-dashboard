import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, employeeLoading, isEmployee, recheckEmployeeAccess } =
    useAuth();
  const [rechecking, setRechecking] = useState(false);
  const autoRetriedRef = useRef(false);

  // After login, a transient API failure can leave the user signed in but not
  // marked as employee — retry once before showing the denial screen.
  useEffect(() => {
    if (
      user &&
      !isEmployee &&
      !employeeLoading &&
      !rechecking &&
      !autoRetriedRef.current
    ) {
      autoRetriedRef.current = true;
      setRechecking(true);
      void recheckEmployeeAccess().finally(() => setRechecking(false));
    }
  }, [user, isEmployee, employeeLoading, rechecking, recheckEmployeeAccess]);

  useEffect(() => {
    if (!user) {
      autoRetriedRef.current = false;
    }
  }, [user]);

  const accessStillPending =
    employeeLoading ||
    rechecking ||
    (user && !isEmployee && !autoRetriedRef.current);

  // Only block the app before we know the user is an employee (not on token refresh / re-check).
  if (loading || (user && accessStillPending && !isEmployee)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">
            {accessStillPending ? "Verifying access…" : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isEmployee) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-amber-500/40 rounded-xl p-6 text-center space-y-3">
          <p className="text-amber-400 font-semibold">Access not granted</p>
          <p className="text-slate-300 text-sm">
            {user.email
              ? `Signed in as ${user.email}, but this account is not registered as an employee.`
              : "Your account is not registered as an employee."}
          </p>
          <p className="text-slate-500 text-xs">
            Your Supabase login is separate from the <code className="text-slate-400">employees</code>{" "}
            table. The email here must match a row in that table exactly (e.g.{" "}
            <code className="text-slate-400">{user.email}</code>). After an admin adds you, click retry
            below.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              disabled={rechecking || employeeLoading}
              onClick={async () => {
                setRechecking(true);
                try {
                  await recheckEmployeeAccess();
                } finally {
                  setRechecking(false);
                }
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {rechecking || employeeLoading ? "Checking access…" : "Retry access check"}
            </button>
            <a href="/login" className="inline-block text-blue-400 text-sm hover:underline">
              Back to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

