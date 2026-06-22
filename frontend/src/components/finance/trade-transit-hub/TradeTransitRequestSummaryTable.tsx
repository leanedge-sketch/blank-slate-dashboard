import type { TradeTransitRequestSummary } from "../../../utils/tradeTransitRequest";
import { TransitSummaryTable } from "./summary/TransitSummaryTable";

type TradeTransitRequestSummaryTableProps = {
  clientName: string;
  summary: TradeTransitRequestSummary;
  className?: string;
  fullPanel?: boolean;
};

export function TradeTransitRequestSummaryTable({
  clientName,
  summary,
  className = "",
  fullPanel = false,
}: TradeTransitRequestSummaryTableProps) {
  return (
    <TransitSummaryTable
      clientName={clientName}
      items={summary.items}
      totals={summary.totals}
      customsPaidEtb={summary.totals.customsPaidEtb}
      className={className}
      fullPanel={fullPanel}
    />
  );
}
