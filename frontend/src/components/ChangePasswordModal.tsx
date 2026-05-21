import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  confirmPasswordChange,
  startPasswordChange,
} from "../services/api";

type Step = "form" | "verify" | "done";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { user, employeeData, signOut, isDevMockSession } = useAuth();
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
  const [verificationCode, setVerificationCode] = useState("");
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

  const handleSendCode = async (e: React.FormEvent) => {
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
      const result = await startPasswordChange({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setMessage(
        result.message ||
          `A verification code was sent to ${email}. Check your inbox.`,
      );
      setStep("verify");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = verificationCode.trim();
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordChange({
        verification_code: code,
        new_password: newPassword,
      });
      setMessage(
        `Password updated. A confirmation was sent to ${email}. Sign in with your new password.`,
      );
      setStep("done");
      await signOut();
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (isDevMockSession) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <div className="modal-header">
            <h2>Change password</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <p className="modal-hint">
              Password change requires a real Supabase account. Sign out and use
              your employee email on the login page, or keep using dev mock for
              UI testing only.
            </p>
            <button type="button" className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        ) : step === "verify" ? (
          <form className="modal-body" onSubmit={handleConfirm}>
            {message && <p className="modal-info">{message}</p>}
            <p className="modal-hint">
              Enter the 6-digit code we sent to <strong>{email}</strong>. Your
              new password will apply after confirmation.
            </p>
            <label className="modal-field">
              <span>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ""))
                }
                autoComplete="one-time-code"
                required
              />
            </label>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStep("form");
                  setVerificationCode("");
                  setError(null);
                }}
              >
                Back
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Confirming…" : "Confirm new password"}
              </button>
            </div>
          </form>
        ) : (
          <form className="modal-body" onSubmit={handleSendCode}>
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
              We will email a verification code to your account. After you enter
              the code, your new password is saved and you can sign in with it.
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
                {loading ? "Sending code…" : "Send verification code"}
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
