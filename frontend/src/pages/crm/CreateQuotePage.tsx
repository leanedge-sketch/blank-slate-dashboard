import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ChemicalType, Customer, fetchChemicalTypes } from "../../services/api";
import { FileText, Loader2, Sparkles, Package, Settings2 } from "lucide-react";

type QuoteFormat = "Baracoda" | "Betchem";

type ProductLine = {
  id: string;
  chemicalTypeId: string;
  quantity: string;
  unit: string;
  targetPrice: string;
  notes: string;
};

const formatFields: Record<QuoteFormat, string[]> = {
  Baracoda: [
    "Customer details",
    "Delivery terms",
    "Payment terms",
    "Validity",
    "Products (qty, unit, price)",
  ],
  Betchem: [
    "Customer details",
    "Payment terms",
    "Packing / Incoterms",
    "Validity",
    "Products (qty, unit, price)",
  ],
};

const units = ["MT", "KG", "L", "Bag", "Carton", "Drum"];

export function CreateQuotePage() {
  const [loading, setLoading] = useState(false);
  const [chemLoading, setChemLoading] = useState(false);
  const [chemicals, setChemicals] = useState<ChemicalType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<QuoteFormat>("Baracoda");

  const [customerName, setCustomerName] = useState("");
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [reference, setReference] = useState("");
  // Start empty; let the user fill these explicitly per quote
  const [validity, setValidity] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [incoterms, setIncoterms] = useState("");
  const [notes, setNotes] = useState("");
  // Start empty; user adds the first product when ready
  const [productLines, setProductLines] = useState<ProductLine[]>([]);

  useEffect(() => {
    async function loadChemicals() {
      try {
        setChemLoading(true);
        const res = await fetchChemicalTypes({ limit: 200, offset: 0 });
        setChemicals(res.chemicals);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load product list");
      } finally {
        setChemLoading(false);
      }
    }
    loadChemicals();
  }, []);

  // Lightweight, optional CRM customer lookup based on the typed name
  useEffect(() => {
    const term = customerName.trim();
    if (term.length < 2) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }

    let cancelled = false;
    async function search() {
      try {
        setCustomerSearchLoading(true);
        const res = await api.get<{ customers: Customer[] }>("/crm/customers", {
          params: { q: term, limit: 8, offset: 0 },
        });
        if (!cancelled) {
          setCustomerSearchResults(res.data.customers);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Customer search failed", err);
          setCustomerSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setCustomerSearchLoading(false);
        }
      }
    }

    const handle = setTimeout(search, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [customerName]);

  const selectedFormatFields = formatFields[format];

  const summaryReady = useMemo(() => {
    return (
      customerName.trim() &&
      productLines.some((p) => p.chemicalTypeId.trim() && p.quantity.trim())
    );
  }, [customerName, productLines]);

  function addLine() {
    setProductLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        chemicalTypeId: "",
        quantity: "",
        unit: "MT",
        targetPrice: "",
        notes: "",
      },
    ]);
  }

  function updateLine(id: string, patch: Partial<ProductLine>) {
    setProductLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function removeLine(id: string) {
    setProductLines((prev) => prev.filter((l) => l.id !== id));
  }

  function handleGenerateDraft() {
    // Placeholder for backend wiring; currently just a UI draft
    setLoading(true);
    // Build a simple summary string for logging / future use
    const productSummary = productLines
      .filter((p) => p.chemicalTypeId && p.quantity)
      .map((p) => {
        const name = getChemicalName(p.chemicalTypeId);
        return `${name} – ${p.quantity} ${p.unit || ""} @ ${p.targetPrice || "N/A"}`;
      })
      .join("; ");

    const interactionText = `Quotation draft generated (${format}) for ${customerName || "N/A"}.
Reference: ${reference || "N/A"}
Validity: ${validity || "N/A"}
Payment terms: ${paymentTerms || "N/A"}
Delivery terms: ${deliveryTerms || "N/A"}
Incoterms: ${incoterms || "N/A"}
Products: ${productSummary || "N/A"}
Notes: ${notes || "N/A"}`;

    async function run() {
      try {
        // If the quote is linked to an existing CRM customer, log a summary interaction
        if (linkedCustomer?.customer_id) {
          try {
            await api.post(`/crm/customers/${linkedCustomer.customer_id}/interactions`, {
              input_text: "Quotation draft generated for this customer.",
              ai_response: interactionText,
            });
          } catch (err) {
            // Do not block the UI on interaction logging
            console.error("Failed to log quotation interaction", err);
          }
        }

        // Ask backend to generate an AI-enhanced Excel and trigger download
        try {
          const payload = {
            format,
            customer_name: customerName,
            reference,
            validity,
            payment_terms: paymentTerms,
            delivery_terms: deliveryTerms,
            incoterms,
            notes,
            linked_customer_id: linkedCustomer?.customer_id ?? null,
            products: productLines
              .filter((p) => p.chemicalTypeId && p.quantity)
              .map((p) => ({
                chemical_type_name: getChemicalName(p.chemicalTypeId),
                quantity: Number(p.quantity),
                unit: p.unit,
                target_price: p.targetPrice || null,
                notes: p.notes || null,
              })),
          };

          const res = await api.post("/crm/quotes/generate", payload, {
            responseType: "blob",
          });

          const blobUrl = window.URL.createObjectURL(
            new Blob([res.data], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })
          );
          const link = document.createElement("a");
          link.href = blobUrl;
          const safeName = customerName || "quotation";
          link.download = `${safeName}_${format}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
          console.error("Failed to download generated quote", err);
          alert("Quote generated but download failed. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }

    void run();
  }

  function getChemicalName(id: string) {
    return chemicals.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-md">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-7 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                CRM · Quotation Draft
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-50">
                  Create Quotation Draft
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 border border-slate-700">
                  <FileText size={14} className="text-emerald-400" />
                  2 formats available
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                Choose a quotation format (Baracoda or Betchem), pick products from your
                chemical_types catalog, and build a draft. Attach the right Excel template later.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <Sparkles size={16} className="text-amber-300" />
              Templates: Baracoda.xlsx, Betchem.xlsx (add more later)
            </div>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateDraft();
          }}
          className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        >
          {/* Left column */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Basics
                </p>
                <h2 className="text-lg font-semibold text-slate-900">Quotation details</h2>
              </div>
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500">Frontend draft (no save yet)</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Customer (type name, optional link to CRM) *
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  placeholder="Customer name or display ID"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
                {customerSearchLoading && (
                  <p className="mt-1 text-[11px] text-slate-500">Searching CRM customers…</p>
                )}
                {!customerSearchLoading && customerSearchResults.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-sm text-xs">
                    {customerSearchResults.map((c) => (
                      <button
                        key={c.customer_id}
                        type="button"
                        onClick={() => {
                          setLinkedCustomer(c);
                          setCustomerName(c.customer_name);
                          setCustomerSearchResults([]);
                        }}
                        className="block w-full text-left px-3 py-1.5 hover:bg-blue-50 text-slate-800"
                      >
                        {c.customer_name}{" "}
                        {c.display_id ? <span className="text-slate-500">({c.display_id})</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                {linkedCustomer && (
                  <p className="mt-1 text-[11px] text-emerald-600">
                    Linked to CRM: {linkedCustomer.customer_name}
                    {linkedCustomer.display_id ? ` (${linkedCustomer.display_id})` : ""}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Quote format *</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as QuoteFormat)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                >
                  <option value="Baracoda">Baracoda (Baracoda.xlsx)</option>
                  <option value="Betchem">Betchem (Betchem.xlsx)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Reference</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. LC-Q-2025-001"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Validity</label>
                <input
                  value={validity}
                  onChange={(e) => setValidity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Payment terms</label>
                <input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Delivery terms</label>
                <input
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Incoterms (Betchem)</label>
                <input
                  value={incoterms}
                  onChange={(e) => setIncoterms(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                />
              </div>
            </div>
          </section>

          {/* Right column: format requirements */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-800">
              <Package size={18} className="text-blue-500" />
              <h3 className="text-base font-semibold">Format requirements ({format})</h3>
            </div>
            <p className="text-sm text-slate-600">
              The selected Excel template expects these fields. Fill the matching inputs below.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              {selectedFormatFields.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
                >
                  <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        </form>

        {/* Products */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Products
              </p>
              <h3 className="text-lg font-semibold text-slate-900">Items & pricing</h3>
              <p className="text-xs text-slate-500">
                Choose products from your chemical_types table. Enter quantity, unit, and target price.
              </p>
            </div>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 transition-colors"
            >
              Add product
            </button>
          </div>

          {productLines.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
              <p className="text-sm font-semibold text-slate-900">Start with an empty quote</p>
              <p className="mt-1 text-xs text-slate-600">
                Click <span className="font-semibold">Add product</span> to add the first line item.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            {productLines.map((line, idx) => (
              <div
                key={line.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm"
              >
                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                  <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Product (chemical type) *
                      </label>
                      <select
                        value={line.chemicalTypeId}
                        onChange={(e) => updateLine(line.id, { chemicalTypeId: e.target.value })}
                        required
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                      >
                        <option value="">Select product</option>
                        {chemLoading ? (
                          <option disabled>Loading...</option>
                        ) : (
                          chemicals.map((chem) => (
                            <option key={chem.id} value={chem.id}>
                              {chem.name} {chem.category ? `(${chem.category})` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Quantity *
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                          required
                          placeholder="e.g. 50"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                        />
                        <select
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, { unit: e.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                        >
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">
                        Target price (per unit)
                      </label>
                      <input
                        value={line.targetPrice}
                        onChange={(e) => updateLine(line.id, { targetPrice: e.target.value })}
                        placeholder="e.g. 1200 USD/MT"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-44">
                    <label className="text-xs font-semibold text-slate-700">Notes</label>
                    <textarea
                      value={line.notes}
                      onChange={(e) => updateLine(line.id, { notes: e.target.value })}
                      rows={2}
                      placeholder="Packing, delivery, tech notes..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="self-start text-xs text-rose-500 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Notes
            </p>
            <h3 className="text-lg font-semibold text-slate-900">Commercial / technical</h3>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Payment terms, delivery assumptions, technical caveats..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70"
          />
        </section>

        {/* Preview / summary */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Preview
              </p>
              <h3 className="text-lg font-semibold text-slate-900">Draft snapshot</h3>
              <p className="text-xs text-slate-500">
                Shows the data that will populate the chosen Excel template. Backend save/export coming soon.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={!summaryReady || loading}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/40 hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate draft"
              )}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-900">
                {customerName || "Customer name will appear here"}
              </div>
              <div className="text-xs text-slate-600">
                Format: {format} · Reference: {reference || "—"}
              </div>
              <div className="text-xs text-slate-600">
                Validity: {validity || "—"} · Payment: {paymentTerms || "—"}
              </div>
              <div className="text-xs text-slate-600">
                Delivery: {deliveryTerms || "—"} · Incoterms: {incoterms || "—"}
              </div>
              <div className="text-xs text-slate-500">
                Notes: {notes || "—"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
              <div className="text-sm font-semibold text-slate-900">Products</div>
              {productLines.length === 0 && (
                <div className="text-xs text-slate-500">No products yet.</div>
              )}
              {productLines.map((line) => (
                <div
                  key={line.id}
                  className="text-xs text-slate-700 border border-slate-200 rounded-lg bg-white px-3 py-2"
                >
                  <div className="font-semibold text-slate-900">
                    {getChemicalName(line.chemicalTypeId)}
                  </div>
                  <div className="text-slate-600">
                    Qty: {line.quantity || "—"} {line.unit} · Target:{" "}
                    {line.targetPrice || "—"}
                  </div>
                  {line.notes && <div className="text-slate-500">Notes: {line.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
