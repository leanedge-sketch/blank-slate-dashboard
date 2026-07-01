import type { TradeTransitRequestSummary } from "../../../utils/tradeTransitRequest";
import { TransitSummaryTable } from "./summary/TransitSummaryTable";

type TradeTransitRequestSummaryTableProps = {
  clientName: string;
  contactPerson?: string;
  requestRef?: string;
  summary: TradeTransitRequestSummary;
  className?: string;
  fullPanel?: boolean;
  onEditLine?: (lineId: string) => void;
  onRemoveLine?: (lineId: string) => void;
};

export function TradeTransitRequestSummaryTable({
  clientName,
  contactPerson,
  requestRef,
  summary,
  className = "",
  fullPanel = false,
  onEditLine,
  onRemoveLine,
}: TradeTransitRequestSummaryTableProps) {
  return (
    <TransitSummaryTable
      clientName={clientName}
      contactPerson={contactPerson}
      requestRef={requestRef}
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
