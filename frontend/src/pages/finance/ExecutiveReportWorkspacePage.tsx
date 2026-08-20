import { LayoutDashboard } from "lucide-react";
import { ExecutiveReportDashboard } from "../../components/executive-report/ExecutiveReportDashboard";
import { TradeTransitWorkspaceLayout } from "../../components/finance/trade-transit-hub/TradeTransitWorkspaceLayout";

export function ExecutiveReportWorkspacePage() {
  return (
    <TradeTransitWorkspaceLayout
      title="Executive Report Dashboard"
      subtitle="Canonical executive dashboard for leadership reporting, cross-module rollups, and export."
      icon={<LayoutDashboard className="h-5 w-5 text-violet-400" />}
      backHref="/reports"
      backLabel="Reports workspace"
    >
      <ExecutiveReportDashboard />
    </TradeTransitWorkspaceLayout>
  );
}
