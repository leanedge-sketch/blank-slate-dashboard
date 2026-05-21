import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, FileText } from "lucide-react";

const dockItems = [
  {
    label: "Analytics Dashboard",
    to: "/crm/dashboard",
    icon: BarChart3,
    match: (path: string) => path === "/crm/dashboard",
  },
  {
    label: "Reports & Analysis",
    to: "/crm/reports",
    icon: FileText,
    match: (path: string) => path === "/crm/reports",
  },
];

export function CRMReportAnalysisDock() {
  const location = useLocation();

  return (
    <nav className="crm-report-analysis-dock" aria-label="CRM reports and analysis">
      <div className="crm-report-analysis-dock-inner">
        <span className="crm-report-analysis-dock-label">CRM · Reports &amp; Analysis</span>
        <div className="crm-report-analysis-dock-links">
          {dockItems.map((item) => {
            const Icon = item.icon;
            const active = item.match(location.pathname);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={active ? "crm-report-analysis-dock-link is-active" : "crm-report-analysis-dock-link"}
              >
                <Icon className="crm-report-analysis-dock-icon" aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function isCrmReportAnalysisPath(pathname: string): boolean {
  return pathname === "/crm/dashboard" || pathname === "/crm/reports";
}
