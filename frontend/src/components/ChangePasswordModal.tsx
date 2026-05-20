import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  confirmPasswordChange,
  requestPasswordChangeCode,
} from "../services/api";
import { supabase } from "../lib/supabase";

type Step = "passwords" | "verify" | "done";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { user, employeeData } = useAuth();
  const email = employeeData?.email || user?.email || "";

  const [step, setStep] = useState<Step>("passwords");
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

  const handleSendVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const validationError = validatePasswords();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!email) {
      setError("No email on your account.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError("Current password is incorrect.");
        return;
      }

      await requestPasswordChangeCode();
      setMessage(
        "A verification code was sent to your email. Enter it below to confirm the change.",
      );
      setStep("verify");
    } catch (err: unknown) {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data
              ?.detail
          : null;
      setError(
        detail ||
          (err instanceof Error ? err.message : "Failed to send verification code."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordChange({
        verification_code: code,
        new_password: newPassword,
      });
      setStep("done");
      setMessage("Password updated. A confirmation email was sent to your inbox.");
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
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
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : step === "passwords" ? (
          <form className="modal-body" onSubmit={handleSendVerification}>
            <p className="modal-hint">
              We will email a verification code to <strong>{email}</strong> before
              updating your password.
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
            {message && <p className="modal-info">{message}</p>}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Sending code…" : "Send verification code"}
              </button>
            </div>
          </form>
        ) : (
          <form className="modal-body" onSubmit={handleConfirmChange}>
            <p className="modal-hint">{message}</p>
            <label className="modal-field">
              <span>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-digit code"
                required
              />
            </label>
            {error && <p className="modal-error">{error}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStep("passwords");
                  setVerificationCode("");
                  setError(null);
                }}
              >
                Back
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
