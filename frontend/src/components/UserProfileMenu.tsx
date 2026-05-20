import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, KeyRound, LogOut, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";

function displayLabel(
  employeeData: { name?: string; email: string } | null,
  userEmail?: string | null,
): string {
  if (employeeData?.name?.trim()) {
    return employeeData.name.trim();
  }
  return employeeData?.email || userEmail || "User";
}

function initials(label: string): string {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function UserProfileMenu() {
  const { user, employeeData, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = displayLabel(employeeData, user?.email);
  const email = employeeData?.email || user?.email || "";

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/login");
  };

  return (
    <>
      <div className="user-profile-menu" ref={menuRef}>
        <button
          type="button"
          className="user-profile-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
        >
          <span className="user-profile-avatar" aria-hidden>
            {initials(label)}
          </span>
          <span className="user-profile-name">{label}</span>
          <ChevronDown
            className={`user-profile-chevron ${open ? "is-open" : ""}`}
            size={16}
          />
        </button>

        {open && (
          <div className="user-profile-dropdown" role="menu">
            <div className="user-profile-dropdown-header" role="none">
              <User className="user-profile-dropdown-icon" size={16} />
              <div>
                <span className="user-profile-dropdown-label">Signed in as</span>
                <span className="user-profile-dropdown-value">{label}</span>
                {email && email !== label && (
                  <span className="user-profile-dropdown-email">{email}</span>
                )}
              </div>
            </div>
            <hr className="user-profile-dropdown-divider" />
            <button
              type="button"
              className="user-profile-dropdown-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setShowChangePassword(true);
              }}
            >
              <KeyRound size={16} />
              Change password
            </button>
            <button
              type="button"
              className="user-profile-dropdown-item user-profile-dropdown-item-danger"
              role="menuitem"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        )}
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  );
}
