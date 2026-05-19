// src/routes/logistics.stock-movements.tsx
// Stock Movements ledger — paginated, sortable, filterable table backed by
// the `stock_movements` Supabase table. Server-side filtering (location,
// transaction type, search) and sorting (date / created_at) keep payloads
// small even on large ledgers.

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

import { isSupabaseConfigured } from "@/lib/supabase";
import {
  STOCK_LOCATIONS,
  STOCK_LOCATION_LABELS,
  TRANSACTION_TYPES,
  type StockLocation,
  type TransactionType,
} from "@/lib/enums";
import {
  fetchStockMovements,
  type MovementsQuery,
  type StockMovementRow,
} from "@/lib/stock";

export const Route = createFileRoute("/logistics/stock-movements")({
  head: () => ({
    meta: [
      { title: "Stock Movements — Logistics" },
      {
        name: "description",
        content: "Historical ledger of every stock movement across all locations.",
      },
    ],
  }),
  component: StockMovementsPage,
});

const PAGE_SIZE = 25;

function StockMovementsPage() {
  const [page, setPage] = useState(0);
  const [location, setLocation] = useState<StockLocation | "all">("all");
  const [transactionType, setTransactionType] = useState<
    TransactionType | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [sortBy, setSortBy] = useState<MovementsQuery["sortBy"]>("date");
  const [sortDir, setSortDir] = useState<MovementsQuery["sortDir"]>("desc");

  const query = useMemo<MovementsQuery>(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      location,
      transactionType,
      search,
      sortBy,
      sortDir,
    }),
    [page, location, transactionType, search, sortBy, sortDir],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["stock_movements", query],
    queryFn: () => fetchStockMovements(query),
    enabled: isSupabaseConfigured,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  function toggleSort(col: NonNullable<MovementsQuery["sortBy"]>) {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(0);
  }

  function resetPageAnd(fn: () => void) {
    fn();
    setPage(0);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Stock Movements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every row in the inventory ledger. Filter by location, transaction
          type, or reference text.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <Alert variant="destructive">
          <AlertTitle>Supabase not configured</AlertTitle>
          <AlertDescription>
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to load movements.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filters apply on the server.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-loc">Location</Label>
              <Select
                value={location}
                onValueChange={(v) =>
                  resetPageAnd(() => setLocation(v as StockLocation | "all"))
                }
              >
                <SelectTrigger id="f-loc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {STOCK_LOCATIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {STOCK_LOCATION_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="f-type">Transaction type</Label>
              <Select
                value={transactionType}
                onValueChange={(v) =>
                  resetPageAnd(() =>
                    setTransactionType(v as TransactionType | "all"),
                  )
                }
              >
                <SelectTrigger id="f-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="f-search">Search (reference or remark)</Label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  resetPageAnd(() => setSearch(searchDraft));
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="f-search"
                    className="pl-8"
                    placeholder="DO number, note…"
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Apply
                </Button>
                {search && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSearchDraft("");
                      resetPageAnd(() => setSearch(""));
                    }}
                  >
                    Clear
                  </Button>
                )}
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">
              {total.toLocaleString()} movement{total === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Page {page + 1} of {lastPage + 1}
            </CardDescription>
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
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Failed to load movements</AlertTitle>
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTh
                    label="Date"
                    active={sortBy === "date"}
                    dir={sortDir}
                    onClick={() => toggleSort("date")}
                  />
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty (kg)</TableHead>
                  <TableHead className="text-right">Balance (kg)</TableHead>
                  <TableHead>Reference</TableHead>
                  <SortableTh
                    label="Logged"
                    active={sortBy === "created_at"}
                    dir={sortDir}
                    onClick={() => toggleSort("created_at")}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : rows.length === 0
                    ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-sm text-muted-foreground py-12"
                        >
                          No movements match these filters.
                        </TableCell>
                      </TableRow>
                    )
                    : rows.map((r) => <MovementRow key={r.id} row={r} />)}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-xs text-muted-foreground">
              Showing {rows.length === 0 ? 0 : page * PAGE_SIZE + 1}–
              {page * PAGE_SIZE + rows.length} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage || isFetching}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        {label}
        {!active ? (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
        ) : dir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )}
      </button>
    </TableHead>
  );
}

function MovementRow({ row }: { row: StockMovementRow }) {
  const qty =
    (row.sold_kg ?? 0) +
    (row.purchase_kg ?? 0) +
    (row.sample_or_damage_kg ?? 0) +
    (row.stock_availability_kg ?? 0) +
    (row.inter_company_transfer_kg ?? 0);

  const productLabel = row.product
    ? `${row.product.chemical ?? "?"} — ${row.product.brand ?? "?"}`
    : row.product_id.slice(0, 8) + "…";

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-mono text-xs">
        {row.date}
      </TableCell>
      <TableCell className="max-w-[260px] truncate" title={productLabel}>
        {productLabel}
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {STOCK_LOCATION_LABELS[row.location] ?? row.location}
        </Badge>
        {row.transfer_to_location && (
          <span className="ml-1 text-xs text-muted-foreground">
            → {STOCK_LOCATION_LABELS[row.transfer_to_location] ?? row.transfer_to_location}
          </span>
        )}
      </TableCell>
      <TableCell>
        <TransactionBadge type={row.transaction_type} />
      </TableCell>
      <TableCell className="text-right font-mono">
        {qty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
      </TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">
        {row.balance_kg != null
          ? row.balance_kg.toLocaleString(undefined, { maximumFractionDigits: 3 })
          : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={row.reference ?? ""}>
        {row.reference ?? "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
      </TableCell>
    </TableRow>
  );
}

function TransactionBadge({ type }: { type: TransactionType }) {
  const variant: "default" | "secondary" | "destructive" | "outline" =
    type === "Purchase"
      ? "default"
      : type === "Sales"
        ? "secondary"
        : type === "Damage"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{type}</Badge>;
}
