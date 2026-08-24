import { useEffect, useState, FormEvent, KeyboardEvent, MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  EmployeeProfileMissingError,
  PRODUCTION_APP_URL,
  isAuthNetworkFailure,
  useAuth,
} from "../../contexts/AuthContext";
import { LoginAssistantDrawer, type LoginFailContext } from "../../components/LoginAssistantDrawer";
import { consumeRedirectPath } from "../../lib/redirectPath";
import { isSupabaseConfigured } from "../../lib/supabase";
import { LogIn, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff, MessageCircle } from "lucide-react";

type SubmitState = "idle" | "loading" | "success";

const NETWORK_BANNER =
  "Unable to reach the authentication server. Please check your internet connection.";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkBanner, setNetworkBanner] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [employeeMissing, setEmployeeMissing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContext, setHelpContext] = useState<LoginFailContext>("invalid_credentials");
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const onWrongHost =
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    !window.location.href.startsWith(PRODUCTION_APP_URL);

  useEffect(() => {
    if (searchParams.get("forgot") === "1" || searchParams.get("reset") === "1") {
      setShowForgotPassword(true);
    }
  }, [searchParams]);

  const showNeedHelp = failCount >= 3 || employeeMissing;
  const loading = submitState === "loading";

  const goAfterLogin = () => {
    const next = consumeRedirectPath() || "/";
    navigate(next, { replace: true });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNetworkBanner(false);
    setSubmitState("loading");

    try {
      if (showForgotPassword) {
        const { error: resetError } = await resetPassword(email);
        if (resetError) {
          if (isAuthNetworkFailure(resetError)) {
            setNetworkBanner(true);
            setHelpContext("network");
          } else {
            setError(resetError.message || "Failed to send password reset link");
          }
          setSubmitState("idle");
          return;
        }
        setMagicLinkSent(true);
        setSubmitState("success");
        return;
      }

      const { error: signError } = await signIn(email, password);
      if (signError) {
        if (signError instanceof EmployeeProfileMissingError) {
          setEmployeeMissing(true);
          setHelpContext("employee_missing");
          setError(signError.message);
          setSubmitState("idle");
          return;
        }
        if (isAuthNetworkFailure(signError)) {
          setNetworkBanner(true);
          setHelpContext("network");
          setSubmitState("idle");
          return;
        }
        setFailCount((n) => n + 1);
        setHelpContext("invalid_credentials");
        setError(signError.message || "Invalid email or password");
        setSubmitState("idle");
        return;
      }

      setSubmitState("success");
      window.setTimeout(goAfterLogin, 350);
    } catch (err) {
      if (isAuthNetworkFailure(err)) {
        setNetworkBanner(true);
        setHelpContext("network");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      setSubmitState("idle");
    }
  };

  const syncCapsLock = (
    e: KeyboardEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>,
  ) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const submitLabel = () => {
    if (submitState === "success") {
      return showForgotPassword ? "Link sent" : "Signed in";
    }
    if (submitState === "loading") {
      return showForgotPassword ? "Sending reset link..." : "Signing in...";
    }
    return showForgotPassword ? "Send Reset Link" : "Sign In";
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 border border-amber-500/40 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Supabase not configured</h1>
          <p className="text-slate-400 text-sm">
            Add <code className="text-amber-300">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-amber-300">VITE_SUPABASE_PUBLISHABLE_KEY</code> in Vercel
            → Settings → Environment Variables, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg mx-auto">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white">Welcome Back</h1>
            <p className="text-slate-400 text-sm">
              Sign in to access LeanChem Connect
            </p>
          </div>

          {magicLinkSent && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Password reset link sent!</p>
                <p className="text-xs mt-1 text-green-300">
                  Check your email and click the link to reset your password.
                </p>
              </div>
            </div>
          )}

          {onWrongHost && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>
                You may be on an old deployment URL. Use{" "}
                <a
                  href={PRODUCTION_APP_URL}
                  className="text-amber-100 underline font-semibold"
                >
                  {PRODUCTION_APP_URL.replace("https://", "")}
                </a>{" "}
                and hard-refresh (Ctrl+Shift+R).
              </p>
            </div>
          )}

          {networkBanner && (
            <div
              role="alert"
              className="flex items-center gap-3 p-4 rounded-xl bg-red-600/20 border border-red-500/50 text-red-300"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{NETWORK_BANNER}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="employee@leanchem.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div
              className={`grid transition-all duration-300 ease-in-out ${
                showForgotPassword
                  ? "grid-rows-[0fr] opacity-0 -mt-2"
                  : "grid-rows-[1fr] opacity-100"
              }`}
            >
              <div className="overflow-hidden">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="block text-sm font-semibold text-slate-300"
                  >
                    Password
                  </label>
                  {capsLockOn && (
                    <span
                      role="status"
                      aria-live="polite"
                      className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-amber-300"
                    >
                      Caps Lock is ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={syncCapsLock}
                    onKeyUp={syncCapsLock}
                    onClick={syncCapsLock}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    required={!showForgotPassword}
                    className="w-full pl-12 pr-12 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
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
            </div>

            <div className="flex items-center justify-between text-sm">
              {showForgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError(null);
                    setMagicLinkSent(false);
                    setSubmitState("idle");
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ← Back to login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                    setMagicLinkSent(false);
                    setPassword("");
                    setShowPassword(false);
                    setCapsLockOn(false);
                    setSubmitState("idle");
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || magicLinkSent || submitState === "success"}
              className={`w-full py-3 px-4 font-bold rounded-xl transition-all duration-300 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                submitState === "success"
                  ? "bg-emerald-600 text-white"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              }`}
            >
              {submitLabel()}
            </button>
          </form>

          {showNeedHelp && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20"
            >
              <MessageCircle className="h-4 w-4" />
              Need Help?
            </button>
          )}

          <p className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
            Only employees registered in the system can access this application.
          </p>
        </div>
      </div>

      <LoginAssistantDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        failContext={helpContext}
        email={email}
      />
    </div>
  );
}
