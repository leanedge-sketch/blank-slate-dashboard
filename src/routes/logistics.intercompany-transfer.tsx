// src/routes/logistics.intercompany-transfer.tsx
// Inter-Company Stock Transfer — React port of
// backend/app/streamlit_views/intercompany_transfer.py
//
// One submission writes BOTH legs of the ledger via the
// `insert_intercompany_transfer` RPC, which performs both inserts in a single
// transaction so the DEFERRED `validate_stock_transfer_pair` trigger fires
// once at COMMIT with both rows visible.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, Lock } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";

import { isSupabaseConfigured } from "@/lib/supabase";
import {
  STOCK_LOCATIONS,
  UNITS,
  fetchProducts,
  submitIntercompanyTransfer,
  transferSchema,
  type ProductOption,
  type TransferInput,
} from "@/lib/intercompany-transfer";
import { STOCK_LOCATION_LABELS } from "@/lib/enums";

export const Route = createFileRoute("/logistics/intercompany-transfer")({
  head: () => ({
    meta: [
      { title: "Inter-Company Transfers — Logistics" },
      {
        name: "description",
        content:
          "Record a two-leg inter-company stock transfer atomically via Supabase RPC.",
      },
    ],
  }),
  component: IntercompanyTransferPage,
});

const todayISO = () => new Date().toISOString().slice(0, 10);

type FieldErrors = Partial<Record<keyof TransferInput, string>>;

function IntercompanyTransferPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<TransferInput>({
    productId: "",
    date: todayISO(),
    sourceLocation: STOCK_LOCATIONS[0],
    destinationLocation: STOCK_LOCATIONS[1],
    quantityKg: 0,
    unit: "kg",
    reference: "",
    remark: "",
  });

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingProducts(false);
      return;
    }
    let cancelled = false;
    fetchProducts()
      .then((rows) => {
        if (cancelled) return;
        setProducts(rows);
        if (rows.length > 0) {
          setForm((f) => (f.productId ? f : { ...f, productId: rows[0].id }));
        }
      })
      .catch((e: Error) => !cancelled && setProductsError(e.message))
      .finally(() => !cancelled && setLoadingProducts(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const locationsForDest = useMemo(
    () => STOCK_LOCATIONS.filter((l) => l !== form.sourceLocation),
    [form.sourceLocation],
  );

  function update<K extends keyof TransferInput>(key: K, value: TransferInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = transferSchema.safeParse(form);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof TransferInput;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    if (!isSupabaseConfigured) {
      setFormError(
        "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitIntercompanyTransfer(parsed.data);
      toast.success("Transfer recorded", {
        description: `Source ${result.source_id.slice(0, 8)}… ⇄ Destination ${result.destination_id.slice(0, 8)}…`,
      });
      // Reset quantity + reference for the next entry; keep locations/product.
      setForm((f) => ({ ...f, quantityKg: 0, reference: "", remark: "" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setFormError(msg);
      toast.error("Transfer rejected", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Toaster richColors position="top-right" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6" />
          Inter-Company Stock Transfer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One submission writes BOTH legs of the ledger. The database trigger
          rejects the pair if quantities don't balance.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Supabase not configured</AlertTitle>
          <AlertDescription>
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in the project env to
            enable RPC calls.
          </AlertDescription>
        </Alert>
      )}

      {productsError && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Failed to load products</AlertTitle>
          <AlertDescription>{productsError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Transfer details</CardTitle>
          <CardDescription>
            Submitted atomically via{" "}
            <code>insert_intercompany_transfer</code> RPC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Product + Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="product">Product</Label>
                <Select
                  value={form.productId}
                  onValueChange={(v) => update("productId", v)}
                  disabled={loadingProducts || products.length === 0}
                >
                  <SelectTrigger id="product">
                    <SelectValue
                      placeholder={
                        loadingProducts
                          ? "Loading products…"
                          : products.length === 0
                            ? "No products available"
                            : "Select a product"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.productId && (
                  <p className="text-xs text-destructive">{errors.productId}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date">Transfer date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => update("date", e.target.value)}
                />
                {errors.date && (
                  <p className="text-xs text-destructive">{errors.date}</p>
                )}
              </div>
            </div>

            {/* Source / Destination */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="src">Source location</Label>
                <Select
                  value={form.sourceLocation}
                  onValueChange={(v) => {
                    update("sourceLocation", v as TransferInput["sourceLocation"]);
                    if (v === form.destinationLocation) {
                      const next = STOCK_LOCATIONS.find((l) => l !== v);
                      if (next)
                        update(
                          "destinationLocation",
                          next as TransferInput["destinationLocation"],
                        );
                    }
                  }}
                >
                  <SelectTrigger id="src">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_LOCATIONS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sourceLocation && (
                  <p className="text-xs text-destructive">
                    {errors.sourceLocation}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dst">Destination location</Label>
                <Select
                  value={form.destinationLocation}
                  onValueChange={(v) =>
                    update(
                      "destinationLocation",
                      v as TransferInput["destinationLocation"],
                    )
                  }
                >
                  <SelectTrigger id="dst">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locationsForDest.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.destinationLocation && (
                  <p className="text-xs text-destructive">
                    {errors.destinationLocation}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="qty">Quantity (kg)</Label>
                <Input
                  id="qty"
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.quantityKg || ""}
                  onChange={(e) =>
                    update("quantityKg", Number(e.target.value) || 0)
                  }
                />
                {errors.quantityKg && (
                  <p className="text-xs text-destructive">{errors.quantityKg}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => update("unit", v as TransferInput["unit"])}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference + Remark */}
            <div className="space-y-1.5">
              <Label htmlFor="ref">Reference / DO #</Label>
              <Input
                id="ref"
                value={form.reference ?? ""}
                onChange={(e) => update("reference", e.target.value)}
                placeholder="e.g. DO-2026-0001"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                rows={3}
                value={form.remark ?? ""}
                onChange={(e) => update("remark", e.target.value)}
              />
            </div>

            {formError && (
              <Alert variant="destructive">
                <AlertTitle>Submission failed</AlertTitle>
                <AlertDescription className="break-words">
                  {formError}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit transfer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
