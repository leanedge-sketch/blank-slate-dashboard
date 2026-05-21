import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { isRequestAborted } from "../../lib/request-errors";
import { AlertCircle } from "lucide-react";

function readCallbackType(
  searchParams: URLSearchParams,
): string | null {
  const fromQuery = searchParams.get("type");
  if (fromQuery) return fromQuery;
  const hashParams = new URLSearchParams(
    window.location.hash.substring(1),
  );
  return hashParams.get("type");
}

function shouldSetPassword(
  user: Session["user"],
  type: string | null,
): boolean {
  const passwordSet =
    user.user_metadata?.password_set === true ||
    user.app_metadata?.password_set === true;
  return type === "setup" || type === "reset" || !passwordSet;
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let finished = false;

    const finish = (session: Session | null) => {
      if (finished) return;
      finished = true;
      setLoading(false);

      const user = session?.user;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const type = readCallbackType(searchParams);
      if (shouldSetPassword(user, type)) {
        navigate("/auth/set-password", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorCode =
      searchParams.get("error_code") || hashParams.get("error_code");
    const errorDescription =
      searchParams.get("error_description") ||
      hashParams.get("error_description");

    if (errorCode) {
      let errorMessage = "Authentication failed";
      if (errorCode === "otp_expired") {
        errorMessage = "The magic link has expired. Please request a new one.";
      } else if (errorDescription) {
        errorMessage = decodeURIComponent(
          errorDescription.replace(/\+/g, " "),
        );
      }
      finished = true;
      setError(errorMessage);
      setLoading(false);
      return;
    }

    // detectSessionInUrl parses the hash — do not call setSession() again here.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "PASSWORD_RECOVERY"
      ) {
        finish(session);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          finish(session);
        }
      })
      .catch((err) => {
        if (!isRequestAborted(err)) {
          console.error("Auth callback session read failed:", err);
        }
      });

    const timeout = window.setTimeout(() => {
      if (!finished) {
        finished = true;
        setLoading(false);
        navigate("/login", { replace: true });
      }
    }, 12000);

    return () => {
      finished = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
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
