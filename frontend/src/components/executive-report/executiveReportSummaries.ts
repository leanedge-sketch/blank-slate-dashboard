import {
  buildCustomerLedger,
  buildProductLedger,
  formatEtbCompact,
} from "./executiveReportData";
import type {
  CognitiveSummary,
  EnrichedShipment,
  SelectedEntity,
} from "./executiveReportTypes";

function avgMargin(shipments: EnrichedShipment[]): number {
  if (shipments.length === 0) return 0;
  return (
    shipments.reduce((sum, s) => sum + s.marginPct, 0) / shipments.length
  );
}

function marginTrend(shipments: EnrichedShipment[]): "rising" | "falling" | "stable" {
  if (shipments.length < 2) return "stable";
  const sorted = [...shipments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const mid = Math.floor(sorted.length / 2);
  const early = sorted.slice(0, mid);
  const late = sorted.slice(mid);
  const earlyAvg = avgMargin(early);
  const lateAvg = avgMargin(late);
  if (lateAvg - earlyAvg > 1.5) return "rising";
  if (earlyAvg - lateAvg > 1.5) return "falling";
  return "stable";
}

export function buildCognitiveSummary(
  allShipments: EnrichedShipment[],
  filtered: EnrichedShipment[],
  entity: SelectedEntity,
): CognitiveSummary {
  if (!entity) {
    return buildGlobalSummary(allShipments);
  }
  if (entity.type === "product") {
    return buildProductSummary(filtered, entity.label);
  }
  return buildCustomerSummary(filtered, entity.label);
}

function buildGlobalSummary(shipments: EnrichedShipment[]): CognitiveSummary {
  const trend = marginTrend(shipments);
  const products = buildProductLedger(shipments, "frequency");
  const customers = buildCustomerLedger(shipments, "volume");
  const topProduct = products[0];
  const topCustomer = customers[0];
  const totalRevenue = shipments.reduce((s, r) => s + r.revenueEtb, 0);
  const concentration =
    topCustomer && totalRevenue > 0
      ? (topCustomer.totalRevenueEtb / totalRevenue) * 100
      : 0;

  const trendText =
    trend === "rising"
      ? "Overall gross margin is trending upward across the selected period."
      : trend === "falling"
        ? "Overall gross margin is softening — review pricing on high-volume lanes."
        : "Overall gross margin is stable within the selected window.";

  const productText = topProduct
    ? `${topProduct.name} leads pipeline activity with ${topProduct.shipmentCount} costing run${topProduct.shipmentCount === 1 ? "" : "s"} and ${formatEtbCompact(topProduct.totalProfitEtb)} ETB cumulative profit.`
    : "No product activity recorded in this date range.";

  const riskText =
    concentration >= 45
      ? `Concentration risk: ${topCustomer?.name ?? "one buyer"} represents ${concentration.toFixed(0)}% of modeled revenue — diversify pipeline exposure.`
      : concentration >= 25
        ? `Moderate buyer concentration (${concentration.toFixed(0)}% with ${topCustomer?.name ?? "top account"}) — monitor dependency.`
        : "Revenue concentration across buyers is well distributed for this period.";

  return {
    tone: "global",
    headline: "Global pipeline health",
    bullets: [trendText, productText, riskText],
  };
}

function buildProductSummary(
  shipments: EnrichedShipment[],
  productName: string,
): CognitiveSummary {
  const trend = marginTrend(shipments);
  const buyers = buildCustomerLedger(shipments, "volume").slice(0, 2);
  const avgCustoms =
    shipments.length > 0
      ? shipments.reduce((s, r) => s + r.customsEtb, 0) / shipments.length
      : 0;
  const avgOrigin =
    shipments.length > 0
      ? shipments.reduce((s, r) => s + r.originOutlayEtb, 0) / shipments.length
      : 0;
  const customsShare = avgOrigin + avgCustoms > 0 ? avgCustoms / (avgOrigin + avgCustoms) : 0;

  const stability =
    trend === "rising"
      ? `Margin on ${productName} is improving over the selected window.`
      : trend === "falling"
        ? `Margin on ${productName} is compressing — validate supplier and customs assumptions.`
        : `${productName} shows stable margin performance in this period.`;

  const buyerText =
    buyers.length >= 2
      ? `Top buyers: ${buyers[0].name} (${buyers[0].totalVolumeKg.toLocaleString()} kg) and ${buyers[1].name} (${buyers[1].totalVolumeKg.toLocaleString()} kg).`
      : buyers.length === 1
        ? `Primary buyer: ${buyers[0].name} (${buyers[0].totalVolumeKg.toLocaleString()} kg).`
        : "No buyer attribution on file for this product in the selected range.";

  const logisticsText =
    customsShare > 0.55
      ? `Customs duties dominate landed cost for ${productName} (${(customsShare * 100).toFixed(0)}% of origin+customs) — review CIF reference and duty class.`
      : `Logistics mix is balanced; origin outlay and customs are within normal bands for ${productName}.`;

  return {
    tone: "product",
    headline: `${productName} — micro analysis`,
    bullets: [stability, buyerText, logisticsText],
  };
}

function buildCustomerSummary(
  shipments: EnrichedShipment[],
  customerName: string,
): CognitiveSummary {
  const margin = avgMargin(shipments);
  const products = buildProductLedger(shipments, "profit").slice(0, 3);
  const totalRevenue = shipments.reduce((s, r) => s + r.revenueEtb, 0);
  const totalProfit = shipments.reduce((s, r) => s + r.profitEtb, 0);
  const efficiency =
    margin >= 22
      ? "High"
      : margin >= 15
        ? "Moderate"
        : margin > 0
          ? "Thin"
          : "Under review";

  const rating = `${customerName} earns a ${efficiency.toLowerCase()} margin efficiency rating at ${margin.toFixed(1)}% average gross margin.`;

  const catalogText =
    products.length > 0
      ? `Most purchased: ${products.map((p) => p.name).join(", ")}.`
      : "No product mix data for this buyer in the selected range.";

  const pricingText =
    totalRevenue > 0 && totalProfit / totalRevenue < 0.12
      ? "Pricing tolerance appears tight — protect markup on repeat SKUs or bundle higher-margin lines."
      : "Current pricing band supports healthy markup tolerance on repeat procurement.";

  return {
    tone: "customer",
    headline: `${customerName} — account lens`,
    bullets: [rating, catalogText, pricingText],
  };
}
