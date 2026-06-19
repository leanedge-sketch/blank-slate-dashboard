import { NavLink, useLocation } from "react-router-dom";
import { useCanView } from "../hooks/usePermissions";

const dockItems: {
  label: string;
  to: string;
  section: "crm" | "pms" | "sales" | "stock" | "reports" | null;
  match: (path: string) => boolean;
}[] = [
  { label: "Home", to: "/", section: null, match: (p) => p === "/" },
  { label: "CRM", to: "/crm", section: "crm", match: (p) => p.startsWith("/crm") },
  { label: "PMS", to: "/pms", section: "pms", match: (p) => p.startsWith("/pms") },
  {
    label: "Import Finance",
    to: "/finance/import",
    section: "pms",
    match: (p) => p.startsWith("/finance"),
  },
  {
    label: "Sales",
    to: "/sales/pipeline",
    section: "sales",
    match: (p) => p.startsWith("/sales"),
  },
  { label: "Stock", to: "/stock", section: "stock", match: (p) => p.startsWith("/stock") },
  {
    label: "Reports",
    to: "/reports",
    section: "reports",
    match: (p) => p.startsWith("/reports"),
  },
];

type WorkspaceDockProps = {
  /** When true, render tabs only (parent AppShell provides chrome wrapper). */
  embedded?: boolean;
};

export function WorkspaceDock({ embedded = false }: WorkspaceDockProps) {
  const location = useLocation();
  const canViewCrm = useCanView("crm");
  const canViewPms = useCanView("pms");
  const canViewSales = useCanView("sales");
  const canViewStock = useCanView("stock");
  const canViewReports = useCanView("crm");

  const visibleItems = dockItems.filter((item) => {
    if (item.section === null) return true;
    if (item.section === "crm") return canViewCrm;
    if (item.section === "pms") return canViewPms;
    if (item.section === "sales") return canViewSales;
    if (item.section === "stock") return canViewStock;
    if (item.section === "reports") return canViewReports;
    return true;
  });

  const links = visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              isActive || item.match(location.pathname)
                ? "workspace-dock-link is-active"
                : "workspace-dock-link"
            }
          >
            {item.label}
          </NavLink>
  ));

  if (embedded) {
    return (
      <nav className="workspace-dock workspace-dock--embedded" aria-label="Workspace navigation">
        <div className="workspace-dock-inner">{links}</div>
      </nav>
    );
  }

  return (
    <nav className="workspace-dock" aria-label="Workspace navigation">
      <div className="workspace-dock-inner">{links}</div>
    </nav>
  );
}
