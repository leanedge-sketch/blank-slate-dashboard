import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  fetchTDS,
  fetchChemicalFullData,
  LeanchemProduct,
  LeanchemProductCreate,
  LeanchemProductUpdate,
  Tds,
  ChemicalFullData,
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
} from "lucide-react";

const emptyForm: LeanchemProductCreate = {
  category: "",
  product_type: "",
  tds_id: null,
  prices: null,
  sample_addis: null,
  stock_addis: null,
  stock_nairobi: null,
};

type ProductsTab = "leanchem" | "chemical_catalog";

export function ProductsPage() {
  const [activeTab, setActiveTab] = useState<ProductsTab>("leanchem");
  const [products, setProducts] = useState<LeanchemProduct[]>([]);
  const [chemicalCatalog, setChemicalCatalog] = useState<ChemicalFullData[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<LeanchemProductCreate>({ ...emptyForm });

  async function loadTds() {
    try {
      const res = await fetchTDS({ limit: 500 });
      setTdsList(res.tds);
    } catch {
      setTdsList([]);
    }
  }

  async function loadChemicalCatalog() {
    try {
      setCatalogLoading(true);
      const res = await fetchChemicalFullData({ limit: 500, offset: 0 });
      setChemicalCatalog(res.chemicals);
    } catch {
      setChemicalCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchProducts({
        limit,
        offset,
        category: filterCategory || undefined,
        product_type: filterType || undefined,
      });
      setProducts(res.products);
      setTotal(res.total);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load LeanChem products";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTds();
    loadChemicalCatalog();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filterCategory, filterType]);

  function openCreate() {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(product: LeanchemProduct) {
    setEditingId(product.id);
    setFormData({
      category: product.category || "",
      product_type: product.product_type || "",
      tds_id: product.tds_id || null,
      prices: product.prices || null,
      sample_addis: product.sample_addis || null,
      stock_addis: product.stock_addis || null,
      stock_nairobi: product.stock_nairobi || null,
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingId) {
        await updateProduct(editingId, formData as LeanchemProductUpdate);
      } else {
        await createProduct(formData);
      }
      setShowForm(false);
      await loadProducts();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to save product";
      alert(String(message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this LeanChem product?")) return;
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to delete";
      alert(String(message));
    }
  }

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  function tdsLabel(tdsId: string | null | undefined): string {
    if (!tdsId) return "—";
    const t = tdsList.find((x) => x.id === tdsId);
    if (!t) return tdsId.slice(0, 8) + "…";
    return [t.brand, t.grade].filter(Boolean).join(" · ") || tdsId.slice(0, 8) + "…";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link to="/pms" className="text-slate-400 hover:text-slate-200">
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                  PMS · leanchem_products
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
                <Package className="text-amber-400" size={32} />
                LeanChem Products
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                LeanChem branded SKUs (<code className="text-amber-200">leanchem_products</code>)
                plus the full chemical catalog (<code className="text-amber-200">chemical_full_data</code>)
                used by sales pipeline and partners.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold"
            >
              <Plus size={20} />
              Add product
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("leanchem")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "leanchem"
                ? "border-amber-600 text-amber-800"
                : "border-transparent text-slate-500"
            }`}
          >
            LeanChem products
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chemical_catalog")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              activeTab === "chemical_catalog"
                ? "border-amber-600 text-amber-800"
                : "border-transparent text-slate-500"
            }`}
          >
            Chemical catalog (full list)
          </button>
        </div>

        {activeTab === "chemical_catalog" ? (
          catalogLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <p className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
                {chemicalCatalog.length} products in{" "}
                <code className="text-xs bg-slate-100 px-1 rounded">chemical_full_data</code>
                {" "}— manage details on{" "}
                <Link to="/pms/chemicals" className="text-amber-700 font-medium hover:underline">
                  Chemical Master Data
                </Link>
              </p>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Product</th>
                    <th className="text-left px-4 py-3 font-semibold">Vendor</th>
                    <th className="text-left px-4 py-3 font-semibold">Category</th>
                    <th className="text-left px-4 py-3 font-semibold">Sector</th>
                    <th className="text-left px-4 py-3 font-semibold">UUID</th>
                  </tr>
                </thead>
                <tbody>
                  {chemicalCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                        No chemicals in catalog.
                      </td>
                    </tr>
                  ) : (
                    chemicalCatalog.map((c) => (
                      <tr
                        key={c.uuid_id || c.id}
                        className="border-b border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-medium">{c.product_name || "—"}</td>
                        <td className="px-4 py-3">{c.vendor || "—"}</td>
                        <td className="px-4 py-3">{c.product_category || "—"}</td>
                        <td className="px-4 py-3">{c.sector || "—"}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono truncate max-w-[140px]">
                          {c.uuid_id || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by product type…"
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[200px]"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingId ? "Edit product" : "New LeanChem product"}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Category</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.category || ""}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Product type</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.product_type || ""}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Linked TDS (optional)</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={formData.tds_id || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, tds_id: e.target.value || null })
                  }
                >
                  <option value="">— None —</option>
                  {tdsList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {[t.brand, t.grade, t.owner].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
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
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Category</th>
                  <th className="text-left px-4 py-3 font-semibold">Product type</th>
                  <th className="text-left px-4 py-3 font-semibold">TDS</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                      No products in leanchem_products yet.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3">{p.category || "—"}</td>
                      <td className="px-4 py-3 font-medium">{p.product_type || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{tdsLabel(p.tds_id)}</td>
                      <td className="px-4 py-3 text-right">
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
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Page {currentPage} of {totalPages} ({total} products)
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
          </>
        )}
      </main>
    </div>
  );
}
