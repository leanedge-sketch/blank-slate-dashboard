import { Link, useLocation, useNavigate } from "react-router-dom";
import { Calculator, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useImportFinanceDock } from "../contexts/ImportFinanceDockContext";
import { AppBuildBadge } from "./AppBuildBadge";
import { UserProfileMenu } from "./UserProfileMenu";
import { WorkspaceDock } from "./WorkspaceDock";

/**
 * Two-tier app chrome:
 * - Tier 1: brand + build badge (left), account actions (right)
 * - Tier 2: module workspace tabs only (left, under the logo)
 */
export function AppShell() {
  const { user, loading, signOut } = useAuth();
  const { openDock } = useImportFinanceDock();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthScreen =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/auth/");

  if (isAuthScreen) {
    return null;
  }

  return (
    <header className="app-shell" role="banner">
      <div className="app-shell-inner">
        <div className="app-shell-tier1">
          <div className="app-shell-brand">
            <Link to="/" className="app-title-link">
              <h1 className="app-title">LeanChem Connect</h1>
            </Link>
            <AppBuildBadge />
          </div>
          <div className="app-shell-account">
            {loading ? (
              <span className="app-nav-loading">Loading…</span>
            ) : user ? (
              <>
                <button
                  type="button"
                  className="app-import-finance-btn"
                  onClick={openDock}
                  title="Import Finance Calculator"
                >
                  <Calculator className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Import Finance</span>
                </button>
                <UserProfileMenu />
                <button
                  type="button"
                  className="app-sign-out-btn"
                  onClick={async () => {
                    await signOut();
                    navigate("/login");
                  }}
                >
                  <LogOut className="app-sign-out-icon" aria-hidden />
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" className="app-global-header-login">
                Login
              </Link>
            )}
          </div>
        </div>

        {user && (
          <div className="app-shell-tier2">
            <WorkspaceDock embedded />
          </div>
        )}
      </div>
    </header>
  );
}
