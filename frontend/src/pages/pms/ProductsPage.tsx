import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchLeanChemRecommendedProducts,
  createLeanChemRecommendedProduct,
  updateLeanChemRecommendedProduct,
  deleteLeanChemRecommendedProduct,
  fetchMasterDataProductSuggestions,
  LeanChemRecommendedProduct,
  LeanChemRecommendedProductCreate,
  LeanChemRecommendedProductUpdate,
  MasterDataProductSuggestion,
} from "../../services/api";
import {
  Package,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Search,
  Sparkles,
  Link2,
} from "lucide-react";
import {
  LEAN_CHEM_PRODUCT_COLUMNS,
  leanChemCellValue,
  PMS_SECTOR_OPTIONS,
  suggestionToForm,
} from "../../utils/leanChemProductColumns";

const emptyForm: LeanChemRecommendedProductCreate = {
  sector: "",
  vendor: "",
  product_category: "",
  sub_category: "",
  product_name: "",
  generic_name: "",
  product_type: "",
  packing: "",
  hs_code: "",
  country_of_origin: "",
  industry: "",
  source_master_row_no: null,
  recommendation_notes: "",
};

export function ProductsPage() {
  const [products, setProducts] = useState<LeanChemRecommendedProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LeanChemRecommendedProductCreate>({
    ...emptyForm,
  });

  const [suggestions, setSuggestions] = useState<MasterDataProductSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchLeanChemRecommendedProducts({
        limit,
        offset,
        sector: filterSector || undefined,
        search: search || undefined,
      });
      setProducts(res.products);
      setTotal(res.total);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Failed to load LeanChem recommended products";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  }

  const loadSuggestions = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      setLoadingSuggestions(true);
      const res = await fetchMasterDataProductSuggestions(q, 8);
      setSuggestions(res);
      setShowSuggestions(res.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filterSector]);

  useEffect(() => {
    if (!showForm) return;
    const term =
      formData.product_name?.trim() ||
      formData.generic_name?.trim() ||
      formData.hs_code?.trim() ||
      "";
    const timer = setTimeout(() => {
      void loadSuggestions(term);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    showForm,
    formData.product_name,
    formData.generic_name,
    formData.hs_code,
    loadSuggestions,
  ]);

  function openCreate() {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setSuggestions([]);
    setShowSuggestions(false);
    setShowForm(true);
  }

  function openEdit(product: LeanChemRecommendedProduct) {
    setEditingId(product.id);
    setFormData({
      sector: product.sector || "",
      vendor: product.vendor || "",
      product_category: product.product_category || "",
      sub_category: product.sub_category || "",
      product_name: product.product_name || "",
      generic_name: product.generic_name || "",
      product_type: product.product_type || "",
      industry: product.industry || product.product_type || "",
      packing: product.packing || "",
      hs_code: product.hs_code || "",
      country_of_origin: product.country_of_origin || "",
      source_master_row_no: product.source_master_row_no ?? null,
      recommendation_notes: product.recommendation_notes || "",
    });
    setSuggestions([]);
    setShowSuggestions(false);
    setShowForm(true);
  }

  function applySuggestion(suggestion: MasterDataProductSuggestion) {
    setFormData((prev) => ({
      ...prev,
      ...suggestionToForm(suggestion),
      recommendation_notes:
        prev.recommendation_notes?.trim() ||
        "Suggested from Chemical Master Data — review and edit before saving.",
    }));
    setShowSuggestions(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.product_name?.trim()) {
      alert("Product name is required");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...formData,
        product_name: formData.product_name.trim(),
      };
      if (editingId) {
        await updateLeanChemRecommendedProduct(
          editingId,
          payload as LeanChemRecommendedProductUpdate,
        );
      } else {
        await createLeanChemRecommendedProduct(payload);
      }
      setShowForm(false);
      await loadProducts();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Failed to save product";
      alert(String(message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this recommended product?")) return;
    try {
      await deleteLeanChemRecommendedProduct(id);
      await loadProducts();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ||
        (err as Error)?.message ||
        "Failed to delete";
      alert(String(message));
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    loadProducts();
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/20 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link to="/pms" className="text-slate-400 hover:text-slate-200">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                  PMS · LeanChem Recommended
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
                <Package className="text-amber-400" size={32} />
                LeanChem Products
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Curated products LeanChem suggests or recommends. Add manually — when you type a
                name, similar items from{" "}
                <Link to="/pms/chemicals" className="text-amber-300 hover:underline">
                  Chemical Master Data
                </Link>{" "}
                appear as suggestions you can pull in.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold"
            >
              <Plus size={20} />
              Add recommended product
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product name, generic name, HS code…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <select
              value={filterSector}
              onChange={(e) => {
                setFilterSector(e.target.value);
                setOffset(0);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">All sectors</option>
              {PMS_SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold"
            >
              Search
            </button>
          </form>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
            {error.includes("LeanChem_Recommended_Products") && (
              <p className="mt-2 text-xs">
                Run <code className="bg-red-100 px-1 rounded">docs/0006_lean_chem_recommended_products.sql</code>{" "}
                in the Supabase SQL editor to create the table.
              </p>
            )}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit recommended product" : "New recommended product"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-semibold text-amber-900">
                  Suggestions from Chemical Master Data
                </span>
                {loadingSuggestions && (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                )}
              </div>
              <p className="text-xs text-amber-800 mb-3">
                Type a product name, generic name, or HS code — matching master data rows appear
                below. Click one to fill the form.
              </p>
              {showSuggestions && suggestions.length > 0 ? (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <li key={`${s.master_row_no}-${i}`}>
                      <button
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-100/80 text-sm transition-colors"
                      >
                        <span className="font-medium text-slate-900">
                          {s.match_label || s.product_name}
                        </span>
                        {s.master_row_no != null && (
                          <span className="ml-2 text-xs text-slate-500">
                            Master #{s.master_row_no}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-amber-700/80">
                  {formData.product_name?.trim().length >= 2 ||
                  formData.generic_name?.trim().length >= 2
                    ? "No close matches in master data — you can still add manually."
                    : "Start typing to see suggestions…"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Sector</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.sector || ""}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                >
                  <option value="">Select sector…</option>
                  {PMS_SECTOR_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Product name *</span>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.product_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, product_name: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Generic name</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.generic_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, generic_name: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Product type</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.product_type || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, product_type: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Supplier</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.vendor || ""}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Category</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.product_category || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, product_category: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Sub category</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.sub_category || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, sub_category: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Packaging</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.packing || ""}
                  onChange={(e) => setFormData({ ...formData, packing: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">HS code</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.hs_code || ""}
                  onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Country of origin</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.country_of_origin || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, country_of_origin: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-sm font-medium flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" />
                  Master data reference
                </span>
                <input
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value={
                    formData.source_master_row_no != null
                      ? `Chemical Master Data row #${formData.source_master_row_no}`
                      : "— filled when you pick a suggestion —"
                  }
                />
              </label>
              <label className="block space-y-1 md:col-span-3">
                <span className="text-sm font-medium">Why we recommend this</span>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.recommendation_notes || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, recommendation_notes: e.target.value })
                  }
                  placeholder="e.g. Strong fit for construction dry-mix segment…"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <p className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
              {total === 0
                ? "No recommended products yet — add your first LeanChem suggestion above."
                : (
                  <>
                    Showing <strong>{products.length}</strong> of <strong>{total}</strong>{" "}
                    recommended products
                  </>
                )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {LEAN_CHEM_PRODUCT_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-3 py-3 font-semibold text-slate-700 whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="text-right px-3 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td
                        colSpan={LEAN_CHEM_PRODUCT_COLUMNS.length + 1}
                        className="px-4 py-12 text-center text-slate-500"
                      >
                        Empty catalog — build your LeanChem recommendation list here.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-slate-100 hover:bg-amber-50/40"
                      >
                        {LEAN_CHEM_PRODUCT_COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className="px-3 py-2.5 text-slate-700 max-w-[200px] truncate"
                            title={leanChemCellValue(p, col.key)}
                          >
                            {leanChemCellValue(p, col.key)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-2 text-slate-600 hover:text-amber-700"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id)}
                            className="p-2 text-slate-600 hover:text-red-600"
                            aria-label="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="px-3 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="px-3 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
