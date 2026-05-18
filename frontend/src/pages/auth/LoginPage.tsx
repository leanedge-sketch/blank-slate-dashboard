import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { LogIn, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (showForgotPassword) {
        // Password reset flow
        const { error } = await resetPassword(email);
        if (error) {
          setError(error.message || "Failed to send password reset link");
        } else {
          setMagicLinkSent(true);
        }
      } else {
        // Regular password login
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message || "Invalid email or password");
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        {/* Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-16 h-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg mx-auto">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white">Welcome Back</h1>
            <p className="text-slate-400 text-sm">
              Sign in to access LeanChem Connect
            </p>
          </div>

          {/* Success Message (Password Reset Link Sent) */}
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

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
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

            {/* Password Field (hide if forgot password) */}
            {!showForgotPassword && (
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-300 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Forgot Password / Back to Login */}
            <div className="flex items-center justify-between text-sm">
              {showForgotPassword ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError(null);
                    setMagicLinkSent(false);
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
                  }}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || magicLinkSent}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading
                ? showForgotPassword
                  ? "Sending reset link..."
                  : "Signing in..."
                : showForgotPassword
                ? "Send Reset Link"
                : "Sign In"}
            </button>
          </form>

          {/* Footer Note */}
          <p className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800">
            Only employees registered in the system can access this application.
          </p>
        </div>
      </div>
    </div>
  );
}

