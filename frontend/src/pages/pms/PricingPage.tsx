import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPricing,
  createPricing,
  updatePricing,
  deletePricing,
  fetchPartners,
  fetchTDS,
  CostingPricing,
  CostingPricingCreate,
  CostingPricingRow,
} from "../../services/api";
import {
  DollarSign,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Filter,
  Pencil,
  Trash2,
} from "lucide-react";

const EMPTY_PRICING_ROW: CostingPricingRow = {
  incoterm: "FOB",
  cost_usd: "",
  cost_etb: "",
  price_usd: "",
  price_etb: "",
};

export function PricingPage() {
  const [pricing, setPricing] = useState<CostingPricing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [selectedTdsId, setSelectedTdsId] = useState<string>("");

  // Dropdowns
  const [partners, setPartners] = useState<any[]>([]);
  const [tdsList, setTdsList] = useState<any[]>([]);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<CostingPricingCreate>({
    partner_id: "",
    tds_id: "",
    rows: [{ ...EMPTY_PRICING_ROW }],
  });
  const [formRows, setFormRows] = useState<CostingPricingRow[]>([
    { ...EMPTY_PRICING_ROW },
  ]);
  const [editingRecord, setEditingRecord] = useState<{
    partner_id: string;
    tds_id: string;
  } | null>(null);
  const [editRows, setEditRows] = useState<CostingPricingRow[]>([]);

  async function loadPartners() {
    try {
      const res = await fetchPartners({ limit: 500 });
      setPartners(res.partners);
    } catch (err) {
      console.error("Failed to load partners:", err);
    }
  }

  async function loadTDS() {
    try {
      const res = await fetchTDS({ limit: 500 });
      setTdsList(res.tds);
    } catch (err) {
      console.error("Failed to load TDS:", err);
    }
  }

  async function loadPricing() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPricing({
        limit,
        offset,
        partner_id: selectedPartnerId || undefined,
        tds_id: selectedTdsId || undefined,
      });
      setPricing(res.pricing);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartners();
    loadTDS();
  }, []);

  useEffect(() => {
    loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, selectedPartnerId, selectedTdsId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.partner_id || !formData.tds_id) {
      alert("Partner and TDS are required");
      return;
    }

    try {
      setCreating(true);
      await createPricing({ ...formData, rows: formRows });
      setShowCreateForm(false);
      setFormData({
        partner_id: "",
        tds_id: "",
        rows: [{ ...EMPTY_PRICING_ROW }],
      });
      setFormRows([{ ...EMPTY_PRICING_ROW }]);
      await loadPricing();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create pricing record");
    } finally {
      setCreating(false);
    }
  }

  function clearFilters() {
    setSelectedPartnerId("");
    setSelectedTdsId("");
    setOffset(0);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters = selectedPartnerId || selectedTdsId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link
                  to="/pms"
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                  PMS · Pricing & Costing
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <DollarSign className="text-orange-400" size={32} />
                Pricing & Costing Master Data
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Maintain partner/TDS pricing and costing by incoterm. Track pricing relationships
                between partners and TDS records.
              </p>
            </div>

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              {showCreateForm ? "Cancel" : "Add Pricing"}
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Pricing Record</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Partner <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.partner_id}
                    onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select partner...</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.partner || "Unnamed Partner"}
                        {p.partner_country ? ` (${p.partner_country})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    TDS <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.tds_id}
                    onChange={(e) => setFormData({ ...formData, tds_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select TDS...</option>
                    {tdsList.map((tds) => (
                      <option key={tds.id} value={tds.id}>
                        {tds.brand || "Unnamed"} {tds.grade ? `- ${tds.grade}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Cost &amp; price rows (costing_pricing_data.rows)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormRows((r) => [...r, { ...EMPTY_PRICING_ROW }])
                    }
                    className="text-xs font-medium text-orange-700 hover:text-orange-900"
                  >
                    + Add incoterm row
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-2 py-2 text-left">Incoterm</th>
                        <th className="px-2 py-2 text-left">Cost USD</th>
                        <th className="px-2 py-2 text-left">Cost ETB</th>
                        <th className="px-2 py-2 text-left">Price USD</th>
                        <th className="px-2 py-2 text-left">Price ETB</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {formRows.map((row, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          {(["incoterm", "cost_usd", "cost_etb", "price_usd", "price_etb"] as const).map(
                            (field) => (
                              <td key={field} className="px-2 py-1">
                                <input
                                  className="w-full min-w-[80px] rounded border border-slate-300 px-2 py-1"
                                  value={String(row[field] ?? "")}
                                  onChange={(e) => {
                                    const next = [...formRows];
                                    next[idx] = { ...next[idx], [field]: e.target.value };
                                    setFormRows(next);
                                  }}
                                />
                              </td>
                            )
                          )}
                          <td className="px-2 py-1">
                            {formRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFormRows((r) => r.filter((_, i) => i !== idx))
                                }
                                className="text-red-600 text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Pricing"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      partner_id: "",
                      tds_id: "",
                      rows: [],
                    });
                  }}
                  className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">Filters</h3>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Partner</label>
              <select
                value={selectedPartnerId}
                onChange={(e) => {
                  setSelectedPartnerId(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">All partners</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partner || "Unnamed Partner"}
                    {p.partner_country ? ` (${p.partner_country})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">TDS</label>
              <select
                value={selectedTdsId}
                onChange={(e) => {
                  setSelectedTdsId(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">All TDS</option>
                {tdsList.map((tds) => (
                  <option key={tds.id} value={tds.id}>
                    {tds.brand || "Unnamed"} {tds.grade ? `- ${tds.grade}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {loading && pricing.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : pricing.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No pricing records found</p>
            <p className="text-slate-500 text-sm mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "Create your first pricing record to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{pricing.length}</span> of{" "}
                <span className="font-semibold">{total}</span> pricing records
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Partner</th>
                      <th className="text-left px-4 py-3 font-semibold">TDS</th>
                      <th className="text-left px-4 py-3 font-semibold">Incoterm</th>
                      <th className="text-left px-4 py-3 font-semibold">Cost USD</th>
                      <th className="text-left px-4 py-3 font-semibold">Cost ETB</th>
                      <th className="text-left px-4 py-3 font-semibold">Price USD</th>
                      <th className="text-left px-4 py-3 font-semibold">Price ETB</th>
                      <th className="text-right px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.flatMap((price) => {
                      const partner = partners.find((p) => p.id === price.partner_id);
                      const tds = tdsList.find((t) => t.id === price.tds_id);
                      const rows =
                        price.rows && price.rows.length > 0
                          ? price.rows
                          : [{ ...EMPTY_PRICING_ROW }];
                      const key = `${price.partner_id}-${price.tds_id}`;
                      return rows.map((row, rowIdx) => (
                        <tr
                          key={`${key}-${rowIdx}`}
                          className="border-b border-slate-100 hover:bg-slate-50/80"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {rowIdx === 0 ? partner?.partner || "—" : ""}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {rowIdx === 0
                              ? [tds?.brand, tds?.grade].filter(Boolean).join(" · ") || "—"
                              : ""}
                          </td>
                          <td className="px-4 py-3">{row.incoterm || "—"}</td>
                          <td className="px-4 py-3">{row.cost_usd ?? "—"}</td>
                          <td className="px-4 py-3">{row.cost_etb ?? "—"}</td>
                          <td className="px-4 py-3">{row.price_usd ?? "—"}</td>
                          <td className="px-4 py-3">{row.price_etb ?? "—"}</td>
                          <td className="px-4 py-3 text-right">
                            {rowIdx === 0 && (
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  title="Edit rows"
                                  onClick={() => {
                                    setEditingRecord({
                                      partner_id: price.partner_id,
                                      tds_id: price.tds_id,
                                    });
                                    setEditRows(
                                      price.rows?.length
                                        ? [...price.rows]
                                        : [{ ...EMPTY_PRICING_ROW }]
                                    );
                                  }}
                                  className="p-2 text-slate-600 hover:text-orange-700"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Delete"
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        "Delete this partner/TDS pricing record?"
                                      )
                                    )
                                      return;
                                    await deletePricing(
                                      price.partner_id,
                                      price.tds_id
                                    );
                                    await loadPricing();
                                  }}
                                  className="p-2 text-slate-600 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {editingRecord && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">Edit costing &amp; pricing rows</h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["incoterm", "cost_usd", "cost_etb", "price_usd", "price_etb"].map(
                            (h) => (
                              <th key={h} className="px-2 py-2 text-left capitalize">
                                {h.replace("_", " ")}
                              </th>
                            )
                          )}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {editRows.map((row, idx) => (
                          <tr key={idx} className="border-t">
                            {(
                              [
                                "incoterm",
                                "cost_usd",
                                "cost_etb",
                                "price_usd",
                                "price_etb",
                              ] as const
                            ).map((field) => (
                              <td key={field} className="px-2 py-1">
                                <input
                                  className="w-full rounded border px-2 py-1"
                                  value={String(row[field] ?? "")}
                                  onChange={(e) => {
                                    const next = [...editRows];
                                    next[idx] = {
                                      ...next[idx],
                                      [field]: e.target.value,
                                    };
                                    setEditRows(next);
                                  }}
                                />
                              </td>
                            ))}
                            <td>
                              <button
                                type="button"
                                className="text-xs text-red-600"
                                onClick={() =>
                                  setEditRows((r) => r.filter((_, i) => i !== idx))
                                }
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-orange-700 mb-4"
                    onClick={() => setEditRows((r) => [...r, { ...EMPTY_PRICING_ROW }])}
                  >
                    + Add row
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold"
                      onClick={async () => {
                        await updatePricing(
                          editingRecord.partner_id,
                          editingRecord.tds_id,
                          { rows: editRows }
                        );
                        setEditingRecord(null);
                        await loadPricing();
                      }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg border"
                      onClick={() => setEditingRecord(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
