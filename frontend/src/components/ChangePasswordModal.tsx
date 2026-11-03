import { useState } from "react";
import { Mail, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  ADMIN_PASSWORD_RESET_EMAIL,
  requestPasswordResetLink,
} from "../services/api";

type Step = "request" | "done";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { user, employeeData } = useAuth();
  const email = employeeData?.email || user?.email || "";
  const name =
    employeeData?.name?.trim() ||
    (typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    (typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "") ||
    "";

  const [step, setStep] = useState<Step>("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequestResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Could not determine your account email.");
      return;
    }

    setLoading(true);
    try {
      const redirectBase =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const result = await requestPasswordResetLink({
        email,
        reason: "change_password",
        redirect_base: redirectBase,
      });
      setMessage(
        result.message ||
          `A password reset link for ${email} has been sent to ${ADMIN_PASSWORD_RESET_EMAIL} so a new password can be assigned.`,
      );
      setStep("done");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div className="modal-card">
        <div className="modal-header">
          <h2 id="change-password-title">Change password</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {step === "done" ? (
          <div className="modal-body">
            <p className="modal-success">{message}</p>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleRequestResetLink}>
            <div className="modal-account-readonly" aria-readonly="true">
              {name ? (
                <p>
                  <span className="modal-account-label">Account</span>
                  <strong>{name}</strong>
                </p>
              ) : null}
              {email ? (
                <p>
                  <span className="modal-account-label">Email</span>
                  <strong>{email}</strong>
                </p>
              ) : null}
            </div>
            <p className="modal-hint">
              Clicking below sends a password reset link for{" "}
              <strong>{email}</strong> to{" "}
              <strong>{ADMIN_PASSWORD_RESET_EMAIL}</strong> so the administrator
              can assign a new password.
            </p>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                <Mail size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                {loading ? "Sending reset link…" : "Send reset link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function extractApiError(err: unknown): string {
  const detail =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail
      : null;
  return detail || (err instanceof Error ? err.message : "Request failed.");
}
