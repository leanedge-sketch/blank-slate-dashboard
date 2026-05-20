import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, isEmployee } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Loading...</p>
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
            Ask an administrator to add you to the employees table, then sign in again.
          </p>
          <a href="/login" className="inline-block text-blue-400 text-sm hover:underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

