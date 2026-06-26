import {
  buildCustomerLedger,
  buildProductLedger,
  formatEtbCompact,
} from "./executiveReportData";
import {
  buildCurrencyLedger,
  buildFxKpis,
  formatUsdCompact,
} from "./executiveReportFxData";
import type {
  CognitiveSummary,
  EnrichedShipment,
  ExecutiveDeck,
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
  deck: ExecutiveDeck = "products",
): CognitiveSummary {
  if (deck === "fx") {
    return buildFxSummary(filtered.length > 0 ? filtered : allShipments);
  }
  if (!entity) {
    return buildGlobalSummary(allShipments);
  }
  if (entity.type === "product") {
    return buildProductSummary(filtered, entity.label);
  }
  return buildCustomerSummary(filtered, entity.label);
}

export function buildFxSummary(shipments: EnrichedShipment[]): CognitiveSummary {
  const kpis = buildFxKpis(shipments);
  const ledger = buildCurrencyLedger(shipments);

  const usdByCustomer = new Map<string, { name: string; usdRevenue: number }>();
  for (const s of shipments) {
    if (s.currency !== "USD") continue;
    const existing = usdByCustomer.get(s.customerId);
    const add = s.revenueUsd;
    if (!existing) {
      usdByCustomer.set(s.customerId, { name: s.customerName, usdRevenue: add });
    } else {
      usdByCustomer.set(s.customerId, {
        ...existing,
        usdRevenue: existing.usdRevenue + add,
      });
    }
  }
  const hardCurrencyLeader = [...usdByCustomer.values()].sort(
    (a, b) => b.usdRevenue - a.usdRevenue,
  )[0];

  const hardCurrencyText = hardCurrencyLeader
    ? `Top hard-currency provider: ${hardCurrencyLeader.name} at ${formatUsdCompact(hardCurrencyLeader.usdRevenue)} USD invoiced volume.`
    : "No USD-denominated pipeline runs in this window — local-currency exposure dominates.";

  const avgParallel =
    shipments.length > 0
      ? shipments.reduce((sum, s) => sum + s.parallelRate, 0) / shipments.length
      : 0;
  const avgSpread =
    shipments.length > 0
      ? shipments.reduce((sum, s) => sum + s.fxSpread, 0) / shipments.length
      : 0;
  const replacementHeadwindPct =
    avgParallel > 0 ? (avgSpread / avgParallel) * 100 : 0;
  const dangerFloor = Math.max(8, replacementHeadwindPct + 4);

  const etbHighVolume = ledger
    .filter((row) => row.dominantCurrency === "ETB")
    .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg)[0];

  const erosionText =
    avgSpread > 0
      ? `Parallel–official spread averages ${avgSpread.toFixed(2)} ETB (${replacementHeadwindPct.toFixed(1)}% replacement headwind on restock).`
      : "FX spread data is thin in this range — confirm rate snapshots on new pipeline saves.";

  const etbRiskText =
    etbHighVolume && etbHighVolume.avgMarginPct < dangerFloor
      ? `Alert: ${etbHighVolume.name} is a high-volume ETB account at ${etbHighVolume.avgMarginPct.toFixed(1)}% margin — below the ${dangerFloor.toFixed(0)}% floor implied by the current parallel replacement rate.`
      : etbHighVolume
        ? `ETB anchor account ${etbHighVolume.name} (${etbHighVolume.totalVolumeKg.toLocaleString()} kg) holds ${etbHighVolume.avgMarginPct.toFixed(1)}% margin — within FX-adjusted tolerance.`
        : "No dominant ETB buyers with material volume in this period.";

  const blendText = `Blended margin posture: USD ${kpis.usdAvgMarginPct.toFixed(1)}% vs ETB ${kpis.etbAvgMarginPct.toFixed(1)}% (${kpis.blendedMarginPct.toFixed(1)}% weighted average).`;

  return {
    tone: "fx",
    headline: "Currency & FX strategy lens",
    bullets: [hardCurrencyText, erosionText, etbRiskText, blendText],
  };
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
