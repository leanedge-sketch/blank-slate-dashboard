import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { AlertCircle } from "lucide-react";

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check for error in URL
      const errorCode = searchParams.get("error_code") || 
                       new URLSearchParams(window.location.hash.substring(1)).get("error_code");
      const errorDescription = searchParams.get("error_description") || 
                               new URLSearchParams(window.location.hash.substring(1)).get("error_description");

      if (errorCode) {
        let errorMessage = "Authentication failed";
        if (errorCode === "otp_expired") {
          errorMessage = "The magic link has expired. Please request a new one.";
        } else if (errorDescription) {
          errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, " "));
        }
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Handle the hash fragment from the magic link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = searchParams.get("type") || hashParams.get("type"); // setup or reset

      if (accessToken && refreshToken) {
        // Set the session
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error("Error setting session:", error);
          setError("Failed to complete authentication. Please try again.");
          setLoading(false);
        } else {
          // Session is set, now check if user needs to set password
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Check if password is set (first-time user or password reset)
            const passwordSet = user.user_metadata?.password_set === true || 
                              user.app_metadata?.password_set === true;
            
            // If it's a setup/reset flow or password is not set, redirect to set password
            if (type === "setup" || type === "reset" || !passwordSet) {
              navigate("/auth/set-password");
            } else {
              // Password already set, normal login
              navigate("/");
            }
          } else {
            navigate("/login");
          }
        }
      } else {
        // Check if already authenticated
        const { data: { session, user } } = await supabase.auth.getSession();
        if (session && user) {
          // Check if user needs to set password
          const passwordSet = user.user_metadata?.password_set === true || 
                            user.app_metadata?.password_set === true;
          
          if (!passwordSet) {
            navigate("/auth/set-password");
          } else {
            navigate("/");
          }
        } else {
          navigate("/login");
        }
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center p-4">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 mb-6">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <Link
            to="/login"
            className="block w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-blue-500/40 transition-all duration-300 text-center"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-400">Completing sign in...</p>
      </div>
    </div>
  );
}

