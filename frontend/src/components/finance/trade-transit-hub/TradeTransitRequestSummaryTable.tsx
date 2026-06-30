import type { TradeTransitRequestSummary } from "../../../utils/tradeTransitRequest";
import { TransitSummaryTable } from "./summary/TransitSummaryTable";

type TradeTransitRequestSummaryTableProps = {
  clientName: string;
  summary: TradeTransitRequestSummary;
  className?: string;
  fullPanel?: boolean;
  onEditLine?: (lineId: string) => void;
  onRemoveLine?: (lineId: string) => void;
};

export function TradeTransitRequestSummaryTable({
  clientName,
  summary,
  className = "",
  fullPanel = false,
  onEditLine,
  onRemoveLine,
}: TradeTransitRequestSummaryTableProps) {
  return (
    <TransitSummaryTable
      clientName={clientName}
      items={summary.items}
      totals={summary.totals}
      customsPaidEtb={summary.totals.customsPaidEtb}
      className={className}
      fullPanel={fullPanel}
      onEditLine={onEditLine}
      onRemoveLine={onRemoveLine}
    />
  );
}
