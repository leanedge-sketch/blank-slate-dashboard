import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPartners,
  createPartner,
  Partner,
  PartnerCreate,
} from "../../services/api";
import {
  Handshake,
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";

export function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<PartnerCreate>({
    partner: "",
    partner_country: "",
  });

  async function loadPartners() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchPartners({
        limit,
        offset,
        partner_name: search || undefined,
      });
      setPartners(res.partners);
      setTotal(res.total);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load partners";
      setError(String(message));
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
    if (!formData.partner?.trim()) {
      alert("Partner name is required");
      return;
    }

    try {
      setCreating(true);
      await createPartner({
        partner: formData.partner.trim(),
        partner_country: formData.partner_country?.trim() || undefined,
      });
      setShowCreateForm(false);
      setFormData({ partner: "", partner_country: "" });
      await loadPartners();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to create partner";
      alert(String(message));
    } finally {
      setCreating(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
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
                Manage business partners in <code className="text-purple-200">partner_data</code> — used
                for chemical catalog links and pricing.
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-900">New partner</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Partner name *</span>
                <input
                  type="text"
                  value={formData.partner || ""}
                  onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-700">Country</span>
                <input
                  type="text"
                  value={formData.partner_country || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, partner_country: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save partner
            </button>
          </form>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search partners..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Partner</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700">Country</th>
                </tr>
              </thead>
              <tbody>
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-slate-500">
                      No partners found. Add one to use in chemicals and pricing.
                    </td>
                  </tr>
                ) : (
                  partners.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.partner}</td>
                      <td className="px-4 py-3 text-slate-600 flex items-center gap-1">
                        <Globe className="w-4 h-4 text-slate-400" />
                        {p.partner_country || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {currentPage} of {totalPages} ({total} partners)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="px-4 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
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
