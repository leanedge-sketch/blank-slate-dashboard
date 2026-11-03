import { useEffect, useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { consumeRedirectPath } from "../../lib/redirectPath";
import {
  assignPasswordWithToken,
  verifyPasswordResetToken,
} from "../../services/api";
import { Lock, AlertCircle, CheckCircle, Eye, EyeOff, UserCheck } from "lucide-react";

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [targetEmail, setTargetEmail] = useState<string | null>(null);
  const [targetName, setTargetName] = useState<string | null>(null);
  const [assignedSuccess, setAssignedSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { user, loading: authLoading, updatePassword } = useAuth();
  const navigate = useNavigate();

  const urlToken =
    searchParams.get("token") || searchParams.get("reset_token") || "";
  const metadataToken =
    typeof user?.user_metadata?.pending_admin_reset_token === "string"
      ? user.user_metadata.pending_admin_reset_token
      : "";
  const activeToken = urlToken || metadataToken;

  useEffect(() => {
    if (!activeToken) {
      if (!authLoading && !user) {
        navigate("/login", { replace: true });
      }
      return;
    }

    let cancelled = false;
    setVerifyingToken(true);
    setError(null);
    setTokenInvalid(false);

    verifyPasswordResetToken(activeToken)
      .then((res) => {
        if (cancelled) return;
        setTargetEmail(res.email);
        setTargetName(res.name || null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { detail?: string } } }).response
                ?.data?.detail
            : null;
        setTokenInvalid(true);
        setError(
          detail ||
            (err instanceof Error
              ? err.message
              : "This password reset link is invalid or has expired."),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setVerifyingToken(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeToken, authLoading, user, navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      if (activeToken) {
        const res = await assignPasswordWithToken({
          token: activeToken,
          new_password: password,
        });
        setTargetEmail(res.email || targetEmail);
        setAssignedSuccess(true);
        return;
      }

      const { error: updateErr } = await updatePassword(password);
      if (updateErr) {
        setError(updateErr.message || "Failed to set password");
      } else {
        navigate(consumeRedirectPath() || "/", { replace: true });
      }
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : null;
      setError(
        detail ||
          (err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  if (verifyingToken || (!activeToken && authLoading)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400">Verifying password reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg mx-auto">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white">
              {activeToken ? "Assign New Password" : "Set Your Password"}
            </h1>
            <p className="text-slate-400 text-sm">
              {activeToken
                ? "Assign a new password for this LeanChem Connect account"
                : "Create a secure password to protect your account"}
            </p>
          </div>

          {targetEmail && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200">
              <UserCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                  Target Employee Account
                </div>
                {targetName ? (
                  <div className="font-semibold text-white">
                    {targetName} <span className="text-blue-300">({targetEmail})</span>
                  </div>
                ) : (
                  <div className="font-semibold text-white">{targetEmail}</div>
                )}
              </div>
            </div>
          )}

          {assignedSuccess ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-white">
                    New password assigned!
                  </p>
                  <p>
                    The password for <strong>{targetEmail}</strong> has been
                    updated. They can now sign in with this new password.
                  </p>
                </div>
              </div>
              <Link
                to="/login"
                className="block w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl text-center hover:shadow-2xl hover:shadow-emerald-500/40 transition-all duration-300"
              >
                Go to Sign In
              </Link>
            </div>
          ) : tokenInvalid ? (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
              <Link
                to="/login?forgot=1"
                className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl text-center hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300"
              >
                Request a New Reset Link
              </Link>
              <Link
                to="/login"
                className="block w-full py-3 px-4 border border-slate-600 text-slate-200 font-semibold rounded-xl hover:bg-slate-800 transition-all duration-300 text-center"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Password Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New Password Field */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-300 mb-2"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      placeholder="Enter new password (min. 8 characters)"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      title={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-2 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" aria-hidden />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold text-slate-300 mb-2"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      placeholder="Confirm new password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showConfirmPassword}
                      title={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-2 text-slate-300 hover:bg-slate-700/60 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" aria-hidden />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-2 font-semibold">
                    Password requirements:
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li
                      className={
                        password.length >= 8 ? "text-emerald-400" : ""
                      }
                    >
                      • At least 8 characters long
                    </li>
                  </ul>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {loading
                    ? "Saving Password..."
                    : activeToken
                      ? "Assign New Password"
                      : "Set Password"}
                </button>
              </form>
            </>
          )}

          {/* Footer Note */}
          <p className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
            {activeToken
              ? "Once assigned, the employee can sign in immediately with this password."
              : "After setting your password, you'll use it to sign in next time."}
          </p>
        </div>
      </div>
    </div>
  );
}

