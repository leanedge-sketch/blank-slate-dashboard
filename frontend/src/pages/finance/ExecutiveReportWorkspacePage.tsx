import { LayoutDashboard } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ExecutiveReportDashboard } from "../../components/executive-report/ExecutiveReportDashboard";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";
import { TRADE_TRANSIT_ROUTES } from "../../contexts/TradeTransitRequestContext";

export function ExecutiveReportWorkspacePage() {
  const { pathname } = useLocation();
  const fromReports = pathname.startsWith("/reports");

  return (
    <TradeTransitWorkspaceLayout
      title="Executive Report Dashboard"
      subtitle="Stage 4 BI — cross-filter products and customers, cost structure charts, and PDF export."
      icon={<LayoutDashboard className="h-5 w-5 text-violet-400" />}
      backHref={fromReports ? "/reports" : TRADE_TRANSIT_ROUTES.hub}
      backLabel={fromReports ? "Reports workspace" : "Back to hub"}
    >
      <ExecutiveReportDashboard />
    </TradeTransitWorkspaceLayout>
  );
}
