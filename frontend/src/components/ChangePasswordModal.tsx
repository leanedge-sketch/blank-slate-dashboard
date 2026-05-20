import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { changePassword } from "../services/api";

type Step = "form" | "done";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { user, employeeData, signOut } = useAuth();
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

  const [step, setStep] = useState<Step>("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validatePasswords = (): string | null => {
    if (!currentPassword) return "Enter your current password.";
    if (newPassword.length < 8) return "New password must be at least 8 characters.";
    if (newPassword !== confirmPassword) return "New passwords do not match.";
    if (currentPassword === newPassword) {
      return "New password must be different from your current password.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validatePasswords();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      const parts = [result.message];
      if (result.email_sent) {
        parts.push(`A confirmation was sent to ${email}.`);
      } else if (result.notice) {
        parts.push(result.notice);
      }
      parts.push("Sign in again with your new password.");

      setMessage(parts.join(" "));
      setStep("done");
      await signOut();
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setError(
        detail ||
          (err instanceof Error ? err.message : "Failed to update password."),
      );
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
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onClose();
                window.location.href = "/login";
              }}
            >
              Go to sign in
            </button>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handleSubmit}>
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
              Enter your current password and choose a new one. We will email a
              confirmation to your account when email is configured.
            </p>
            <label className="modal-field">
              <span>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="modal-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <label className="modal-field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
