import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPartnerChemicals,
  createPartnerChemical,
  PartnerChemical,
  PartnerChemicalCreate,
} from "../../services/api";
import {
  Handshake,
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Globe,
} from "lucide-react";

export function PartnersPage() {
  const [partners, setPartners] = useState<PartnerChemical[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<PartnerChemicalCreate>({
    vendor: "",
    country: "",
  });

  async function loadPartners() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPartnerChemicals({
        limit,
        offset,
        vendor: search || undefined,
      });
      setPartners(res.partner_chemicals);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load partners");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPartners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.vendor?.trim()) {
      alert("Vendor name is required");
      return;
    }

    try {
      setCreating(true);
      await createPartnerChemical(formData);
      setShowCreateForm(false);
      setFormData({ vendor: "", country: "" });
      await loadPartners();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create partner");
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

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
                  PMS · Partner Master Data
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <Handshake className="text-purple-400" size={32} />
                Partner Master Data
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Manage vendor partners. Track vendor information and country details.
              </p>
            </div>

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              {showCreateForm ? "Cancel" : "Add Partner"}
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Partner</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Vendor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vendor || ""}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={formData.country || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Ethiopia, Kenya"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Partner"
                  )}
                </button>
                <button
                  type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({ vendor: "", country: "" });
                }}
                  className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              loadPartners();
            }}
            className="flex gap-3"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors by name..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:shadow-lg transition-all"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setOffset(0);
                  loadPartners();
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {loading && partners.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No vendors found</p>
            <p className="text-slate-500 text-sm mt-1">
              {search ? "Try a different search term" : "Create your first vendor to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{partners.length}</span> of{" "}
                <span className="font-semibold">{total}</span> vendors
              </p>
            </div>

            {/* Partners List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-900">
                      {partner.vendor || "Unnamed Vendor"}
                    </h3>
                    <Handshake className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  </div>

                  <div className="space-y-2 text-sm">
                    {partner.country && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-500">Country:</span>{" "}
                        <span className="font-medium text-slate-700">
                          {partner.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

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
