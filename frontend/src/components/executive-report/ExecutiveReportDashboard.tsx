import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  Download,
  DollarSign,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  fetchImportFinanceProducts,
  fetchImportShipmentsForReport,
} from "../../services/importFinance";
import {
  buildCostStructure,
  buildCustomerEfficiency,
  buildCustomerLedger,
  buildProductLedger,
  buildRevenueMarginSeries,
  enrichShipments,
  filterByEntity,
  formatRangeLabel,
  resolveDateRange,
} from "./executiveReportData";
import {
  buildCurrencyLedger,
  buildCustomerFxMatrix,
  buildFxKpis,
  buildFxSpreadSeries,
  buildMarginByCurrency,
} from "./executiveReportFxData";
import { buildCognitiveSummary } from "./executiveReportSummaries";
import { exportExecutiveReportPdf } from "./executiveReportPdf";
import { PIPELINE_SAVED_EVENT } from "../../lib/importFinanceEvents";
import { PROCUREMENT_PIPELINE_DOMAIN } from "../../lib/pipelineDomains";
import {
  CostStructureChart,
  CostStructureStackedBar,
  CustomerEfficiencyChart,
  CustomerFxMatrixChart,
  FxSpreadErosionChart,
  MarginByCurrencyChart,
  RevenueMarginChart,
} from "./ExecutiveReportCharts";
import {
  CurrencyLedgerDeck,
  CustomerLedgerDeck,
  FxKpiCards,
  ProductLedgerDeck,
} from "./ExecutiveReportDecks";
import type {
  CustomerSortMode,
  DateRangePreset,
  ExecutiveDeck,
  ProductSortMode,
  SelectedEntity,
} from "./executiveReportTypes";

const RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: "ytd", label: "YTD" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisMonth", label: "This month" },
];

const DECK_OPTIONS: { value: ExecutiveDeck; label: string }[] = [
  { value: "products", label: "Deck A · Products" },
  { value: "customers", label: "Deck B · Customers" },
  { value: "fx", label: "Deck C · Currency & FX" },
];

export function ExecutiveReportDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState<DateRangePreset>("last90");
  const [activeDeck, setActiveDeck] = useState<ExecutiveDeck>("products");
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [productSort, setProductSort] = useState<ProductSortMode>("frequency");
  const [customerSort, setCustomerSort] = useState<CustomerSortMode>("volume");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rawShipments, setRawShipments] = useState<Awaited<
    ReturnType<typeof fetchImportShipmentsForReport>
  >>([]);
  const [products, setProducts] = useState<Awaited<
    ReturnType<typeof fetchImportFinanceProducts>
  >>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = resolveDateRange(dateRange);
      const [shipments, productRows] = await Promise.all([
        fetchImportShipmentsForReport({
          startIso: start.toISOString(),
          endIso: end.toISOString(),
          pipelineDomain: PROCUREMENT_PIPELINE_DOMAIN,
        }),
        fetchImportFinanceProducts(),
      ]);
      setRawShipments(shipments);
      setProducts(productRows);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPipelineSaved = () => {
      void load();
    };
    window.addEventListener(PIPELINE_SAVED_EVENT, onPipelineSaved);
    return () => window.removeEventListener(PIPELINE_SAVED_EVENT, onPipelineSaved);
  }, [load]);

  const allEnriched = useMemo(
    () => enrichShipments(rawShipments, products, dateRange),
    [rawShipments, products, dateRange],
  );

  const chartShipments = useMemo(
    () => filterByEntity(allEnriched, selectedEntity),
    [allEnriched, selectedEntity],
  );

  const productLedger = useMemo(
    () => buildProductLedger(allEnriched, productSort),
    [allEnriched, productSort],
  );

  const customerLedger = useMemo(
    () => buildCustomerLedger(allEnriched, customerSort),
    [allEnriched, customerSort],
  );

  const costStructure = useMemo(
    () => buildCostStructure(chartShipments),
    [chartShipments],
  );
  const revenueSeries = useMemo(
    () => buildRevenueMarginSeries(chartShipments),
    [chartShipments],
  );
  const efficiencyPoints = useMemo(
    () => buildCustomerEfficiency(chartShipments),
    [chartShipments],
  );

  const fxKpis = useMemo(() => buildFxKpis(chartShipments), [chartShipments]);
  const marginByCurrency = useMemo(
    () => buildMarginByCurrency(chartShipments),
    [chartShipments],
  );
  const customerFxMatrix = useMemo(
    () => buildCustomerFxMatrix(chartShipments),
    [chartShipments],
  );
  const fxSpreadSeries = useMemo(
    () => buildFxSpreadSeries(chartShipments),
    [chartShipments],
  );
  const currencyLedger = useMemo(
    () => buildCurrencyLedger(chartShipments),
    [chartShipments],
  );

  const summary = useMemo(
    () =>
      buildCognitiveSummary(allEnriched, chartShipments, selectedEntity, activeDeck),
    [allEnriched, chartShipments, selectedEntity, activeDeck],
  );

  const entityLabel = selectedEntity
    ? `${selectedEntity.type === "product" ? "Product" : "Customer"}: ${selectedEntity.label}`
    : activeDeck === "fx"
      ? "FX global view"
      : "Global view";

  function handleDeckChange(deck: ExecutiveDeck) {
    setActiveDeck(deck);
    if (deck === "products" && selectedEntity?.type === "customer") {
      setSelectedEntity(null);
    }
    if (deck === "customers" && selectedEntity?.type === "product") {
      setSelectedEntity(null);
    }
  }

  async function handleExport(mode: "full" | "textOnly") {
    const root = mode === "full" ? exportRef.current : null;
    if (mode === "full" && !root) return;
    setExporting(true);
    setExportOpen(false);
    try {
      await exportExecutiveReportPdf(
        root ?? document.body,
        summary,
        {
          title:
            activeDeck === "fx"
              ? "Stage 4 · Deck C Currency & FX"
              : "Stage 4 Executive Report",
          rangeLabel: formatRangeLabel(dateRange),
          entityLabel,
        },
        mode,
      );
    } finally {
      setExporting(false);
    }
  }

  const summaryToneClass =
    summary.tone === "fx"
      ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/80"
      : summary.tone === "global"
        ? "border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-slate-900/80"
        : summary.tone === "product"
          ? "border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900/80"
          : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-slate-900/80";

  return (
    <div ref={dashboardRef} className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/90">
            Stage 4 · Executive intelligence
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            Executive Report Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {activeDeck === "fx"
              ? "Currency risk & FX margin analytics — official vs parallel rate exposure."
              : "Cross-filtered pipeline BI — click a product or customer to drill down."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-white/10 bg-slate-900/80 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setDateRange(opt.value);
                  setSelectedEntity(null);
                }}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  dateRange === opt.value
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/30 hover:text-cyan-200 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export PDF
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
            {exportOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close export menu"
                  className="fixed inset-0 z-40"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-white/10 bg-slate-900 py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => void handleExport("full")}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                  >
                    <FileImage className="h-4 w-4 text-cyan-400" />
                    Include visuals &amp; data
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport("textOnly")}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                  >
                    <FileText className="h-4 w-4 text-violet-400" />
                    Text &amp; summaries only
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="inline-flex flex-wrap rounded-xl border border-white/10 bg-slate-900/80 p-1 gap-1">
        {DECK_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleDeckChange(opt.value)}
            className={`rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
              activeDeck === opt.value
                ? opt.value === "fx"
                  ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20"
                  : "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {selectedEntity ? (
        <button
          type="button"
          onClick={() => setSelectedEntity(null)}
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 transition animate-in fade-in duration-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to global view
          <span className="text-cyan-300/70 font-normal">
            · filtering {selectedEntity.label}
          </span>
        </button>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div ref={exportRef} className="space-y-5">
        {activeDeck === "fx" ? (
          <>
            <FxKpiCards kpis={fxKpis} />
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(300px,380px)_1fr] gap-5">
              <CurrencyLedgerDeck
                rows={currencyLedger}
                selected={selectedEntity}
                onSelect={(type, id, label) => setSelectedEntity({ type, id, label })}
              />
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Margin by currency
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Average net profit margin — USD vs ETB invoicing
                    </p>
                    <MarginByCurrencyChart data={marginByCurrency} />
                  </section>

                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      FX spread erosion
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Parallel − official spread vs average ETB margin
                    </p>
                    <FxSpreadErosionChart data={fxSpreadSeries} />
                  </section>
                </div>

                <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Customer FX matrix
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Top 10 customers · revenue stacked by USD vs ETB share
                  </p>
                  <CustomerFxMatrixChart data={customerFxMatrix} />
                </section>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,340px)_1fr] gap-5">
            <div className="space-y-4">
              {activeDeck === "products" ? (
                <ProductLedgerDeck
                  rows={productLedger}
                  selected={selectedEntity}
                  sort={productSort}
                  onSortChange={setProductSort}
                  onSelect={(type, id, label) => setSelectedEntity({ type, id, label })}
                />
              ) : (
                <CustomerLedgerDeck
                  rows={customerLedger}
                  selected={selectedEntity}
                  sort={customerSort}
                  onSortChange={setCustomerSort}
                  onSelect={(type, id, label) => setSelectedEntity({ type, id, label })}
                />
              )}
            </div>

            <div className="space-y-4 transition-all duration-200">
              {activeDeck === "products" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">Cost structure</h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Origin · customs · transit · margin
                    </p>
                    <CostStructureChart data={costStructure} />
                    <CostStructureStackedBar data={costStructure} />
                  </section>

                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Revenue &amp; margin trajectory
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      {formatRangeLabel(dateRange)} · monthly buckets
                    </p>
                    <RevenueMarginChart data={revenueSeries} />
                  </section>
                </div>
              ) : (
                <>
                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Customer efficiency
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Volume (kg) vs margin % — bubble size = revenue
                    </p>
                    <CustomerEfficiencyChart data={efficiencyPoints} />
                  </section>

                  <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Revenue &amp; margin trajectory
                    </h3>
                    <p className="text-[11px] text-slate-500 mb-3">
                      {formatRangeLabel(dateRange)} · monthly buckets
                    </p>
                    <RevenueMarginChart data={revenueSeries} />
                  </section>
                </>
              )}
            </div>
          </div>
        )}

        <section
          className={`rounded-xl border p-5 backdrop-blur-md transition-colors duration-200 ${summaryToneClass}`}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              {summary.tone === "fx" ? (
                <DollarSign className="h-5 w-5 text-amber-300" />
              ) : summary.tone === "global" ? (
                <Sparkles className="h-5 w-5 text-violet-300" />
              ) : (
                <Brain className="h-5 w-5 text-cyan-300" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Cognitive summary · {entityLabel}
              </p>
              <h3 className="text-lg font-bold text-white mt-1">{summary.headline}</h3>
              <ul className="mt-4 space-y-2.5">
                {summary.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2 text-sm text-slate-300 leading-relaxed"
                  >
                    <span
                      className={`shrink-0 ${
                        summary.tone === "fx" ? "text-amber-400" : "text-violet-400"
                      }`}
                    >
                      ▸
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {loading && allEnriched.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pipeline intelligence…
        </div>
      ) : null}
    </div>
  );
}
