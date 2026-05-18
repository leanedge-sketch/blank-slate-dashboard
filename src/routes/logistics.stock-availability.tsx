// src/routes/logistics.stock-availability.tsx
// Stock Availability — executive dashboard. Reads the full `stock_movements`
// ledger (capped at 5000 rows by default) and aggregates net kg per location
// in the browser using the signed-quantity convention in `src/lib/stock.ts`.
//
// For very large ledgers, swap `fetchAllMovementsForAggregation()` for a
// server-side SQL view or RPC that returns pre-aggregated rows.

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Layers,
  RefreshCw,
  Warehouse,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { isSupabaseConfigured } from "@/lib/supabase";
import {
  STOCK_LOCATION_LABELS,
  type StockLocation,
} from "@/lib/enums";
import {
  aggregateByLocation,
  fetchAllMovementsForAggregation,
  type LocationBalance,
} from "@/lib/stock";

export const Route = createFileRoute("/logistics/stock-availability")({
  head: () => ({
    meta: [
      { title: "Stock Availability — Logistics" },
      {
        name: "description",
        content: "Real-time aggregate stock balances per operational location.",
      },
    ],
  }),
  component: StockAvailabilityPage,
});

const fmtKg = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function StockAvailabilityPage() {
  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } =
    useQuery({
      queryKey: ["stock_movements", "all-for-aggregation"],
      queryFn: () => fetchAllMovementsForAggregation(5000),
      enabled: isSupabaseConfigured,
      staleTime: 30_000,
    });

  const balances: LocationBalance[] = data ? aggregateByLocation(data) : [];
  const totalNet = balances.reduce((s, b) => s + b.netKg, 0);
  const totalIn = balances.reduce((s, b) => s + b.inflowKg, 0);
  const totalOut = balances.reduce((s, b) => s + b.outflowKg, 0);
  const totalMovements = balances.reduce((s, b) => s + b.movementCount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Stock Availability
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Net balance per operational location, computed live from the ledger.
            {dataUpdatedAt > 0 && (
              <>
                {" "}
                Updated{" "}
                <span className="font-medium">
                  {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
                .
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {!isSupabaseConfigured && (
        <Alert variant="destructive">
          <AlertTitle>Supabase not configured</AlertTitle>
          <AlertDescription>
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to load balances.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Failed to load ledger</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total net (kg)"
          value={isLoading ? null : fmtKg(totalNet)}
          icon={<Boxes className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Total inflow"
          value={isLoading ? null : fmtKg(totalIn)}
          icon={<ArrowUpRight className="h-4 w-4 text-emerald-500" />}
        />
        <KpiCard
          label="Total outflow"
          value={isLoading ? null : fmtKg(totalOut)}
          icon={<ArrowDownRight className="h-4 w-4 text-rose-500" />}
        />
        <KpiCard
          label="Movements"
          value={isLoading ? null : totalMovements.toLocaleString()}
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Per-location breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          : balances.map((b) => (
              <LocationCard key={b.location} balance={b} totalNet={totalNet} />
            ))}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LocationCard({
  balance,
  totalNet,
}: {
  balance: LocationBalance;
  totalNet: number;
}) {
  const sharePct =
    totalNet > 0 ? Math.max(0, (balance.netKg / totalNet) * 100) : 0;
  const isNegative = balance.netKg < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            {STOCK_LOCATION_LABELS[balance.location as StockLocation] ??
              balance.location}
          </CardTitle>
          <Badge variant={isNegative ? "destructive" : "secondary"}>
            {balance.movementCount} mvmt
          </Badge>
        </div>
        <CardDescription>Live net kg from ledger</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p
            className={`text-3xl font-semibold tabular-nums ${
              isNegative ? "text-destructive" : "text-foreground"
            }`}
          >
            {fmtKg(balance.netKg)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              kg
            </span>
          </p>
          {totalNet > 0 && !isNegative && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, sharePct)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {sharePct.toFixed(1)}% of network stock
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Inflow
            </p>
            <p className="text-sm font-medium tabular-nums">
              {fmtKg(balance.inflowKg)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ArrowDownRight className="h-3 w-3 text-rose-500" /> Outflow
            </p>
            <p className="text-sm font-medium tabular-nums">
              {fmtKg(balance.outflowKg)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
