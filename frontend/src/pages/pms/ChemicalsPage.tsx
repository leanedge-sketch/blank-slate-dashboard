import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchChemicalFullData,
  createChemicalFullData,
  updateChemicalFullData,
  deleteChemicalFullData,
  ChemicalFullData,
  ChemicalFullDataCreate,
  ChemicalFullDataUpdate,
  fetchSectors,
  fetchIndustries,
  fetchPartnerChemicals,
  createPartnerChemical,
  fetchProductCategoriesFullData,
  fetchSubCategoriesFullData,
  fetchProductNames,
} from "../../services/api";
import {
  FlaskConical,
  Search,
  Plus,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Edit2,
  Trash2,
  Eye,
  Filter,
  DollarSign,
  Building2,
  Tag,
  Box,
  FileText,
  Hash,
} from "lucide-react";

export function ChemicalsPage() {
  const [chemicals, setChemicals] = useState<ChemicalFullData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters
  const [search, setSearch] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterProductCategory, setFilterProductCategory] = useState("");
  const [filterSubCategory, setFilterSubCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Options for dropdowns
  const [sectors, setSectors] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; vendor: string }>>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<ChemicalFullDataCreate & { id: number }>({
    id: 0,
    sector: "",
    industry: "",
    partner_id: null,
    vendor: "",
    product_category: "",
    sub_category: "",
    product_name: "",
    packing: "",
    typical_application: "",
    product_description: "",
    hs_code: "",
    price: null,
  });

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<ChemicalFullDataUpdate>({});
  const [updating, setUpdating] = useState(false);

  // View details modal
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingChemical, setViewingChemical] = useState<ChemicalFullData | null>(null);
  
  // Expanded row for showing additional details
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  type AddOptionType =
    | "sector"
    | "industry"
    | "vendor"
    | "product_category"
    | "sub_category";

  const [addOptionType, setAddOptionType] = useState<AddOptionType | null>(null);
  const [newOptionValue, setNewOptionValue] = useState("");

  function openAddOption(type: AddOptionType) {
    setAddOptionType(type);
    setNewOptionValue("");
  }

  function closeAddOption() {
    setAddOptionType(null);
    setNewOptionValue("");
  }

  async function saveNewOption() {
    if (!addOptionType) return;
    const value = newOptionValue.trim();
    if (!value) return;

    const normalize = (v: string) => v.trim().toLowerCase();

    if (addOptionType === "sector") {
      setSectors((prev) => {
        if (prev.some((s) => normalize(s) === normalize(value))) return prev;
        return [...prev, value].sort((a, b) => a.localeCompare(b));
      });
      setFormData((prev) => ({ ...prev, sector: value }));
    } else if (addOptionType === "industry") {
      setIndustries((prev) => {
        if (prev.some((s) => normalize(s) === normalize(value))) return prev;
        return [...prev, value].sort((a, b) => a.localeCompare(b));
      });
      setFormData((prev) => ({ ...prev, industry: value }));
    } else if (addOptionType === "product_category") {
      setProductCategories((prev) => {
        if (prev.some((s) => normalize(s) === normalize(value))) return prev;
        return [...prev, value].sort((a, b) => a.localeCompare(b));
      });
      setFormData((prev) => ({ ...prev, product_category: value }));
    } else if (addOptionType === "sub_category") {
      setSubCategories((prev) => {
        if (prev.some((s) => normalize(s) === normalize(value))) return prev;
        return [...prev, value].sort((a, b) => a.localeCompare(b));
      });
      setFormData((prev) => ({ ...prev, sub_category: value }));
    } else if (addOptionType === "vendor") {
      // Create a new partner_chemicals record
      try {
        const newPartner = await createPartnerChemical({
          vendor: value,
          product_category: formData.product_category || "",
          product_name: "",
          packing: "",
        });
        // Add to vendors list and update form
        setVendors((prev) => {
          if (prev.some((v) => v.id === newPartner.id)) return prev;
          return [...prev, { id: newPartner.id, vendor: newPartner.vendor }].sort((a, b) =>
            a.vendor.localeCompare(b.vendor)
          );
        });
        setFormData((prev) => ({
          ...prev,
          vendor: newPartner.vendor,
          partner_id: newPartner.id,
        }));
      } catch (err: any) {
        console.error("Failed to create partner chemical:", err);
        alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create vendor");
        return; // Don't close modal on error
      }
    }

    closeAddOption();
  }

  async function loadOptions() {
    try {
      // Load each option separately to handle individual failures
      const options = {
        sectors: [] as string[],
        industries: [] as string[],
        vendors: [] as Array<{ id: string; vendor: string }>,
        categories: [] as string[],
        subCategories: [] as string[],
      };

      try {
        const sectorsRes = await fetchSectors();
        options.sectors = Array.isArray(sectorsRes) ? sectorsRes : [];
        console.log("Loaded sectors:", options.sectors.length);
      } catch (err: any) {
        console.error("Failed to load sectors:", err);
        console.error("Error details:", err?.response?.data || err?.message);
      }

      try {
        const industriesRes = await fetchIndustries();
        options.industries = Array.isArray(industriesRes) ? industriesRes : [];
        console.log("Loaded industries:", options.industries.length);
      } catch (err: any) {
        console.error("Failed to load industries:", err);
        console.error("Error details:", err?.response?.data || err?.message);
      }

      try {
        const vendorsRes = await fetchPartnerChemicals({ limit: 1000 });
        options.vendors = (vendorsRes?.partner_chemicals || []).map((pc) => ({
          id: pc.id,
          vendor: pc.vendor,
        }));
        console.log("Loaded vendors:", options.vendors.length);
      } catch (err: any) {
        console.error("Failed to load vendors:", err);
        console.error("Error details:", err?.response?.data || err?.message);
      }

      try {
        const categoriesRes = await fetchProductCategoriesFullData();
        options.categories = Array.isArray(categoriesRes) ? categoriesRes : [];
        console.log("Loaded categories:", options.categories.length);
      } catch (err: any) {
        console.error("Failed to load categories:", err);
        console.error("Error details:", err?.response?.data || err?.message);
      }

      try {
        const subCategoriesRes = await fetchSubCategoriesFullData();
        options.subCategories = Array.isArray(subCategoriesRes) ? subCategoriesRes : [];
        console.log("Loaded sub categories:", options.subCategories.length);
      } catch (err: any) {
        console.error("Failed to load sub categories:", err);
        console.error("Error details:", err?.response?.data || err?.message);
      }

      setSectors(options.sectors);
      setIndustries(options.industries);
      setVendors(options.vendors);
      setProductCategories(options.categories);
      setSubCategories(options.subCategories);

      console.log("All options loaded:", {
        sectors: options.sectors.length,
        industries: options.industries.length,
        vendors: options.vendors.length,
        categories: options.categories.length,
        subCategories: options.subCategories.length,
      });
    } catch (err) {
      console.error("Failed to load options:", err);
      // Don't set error state - let individual dropdowns show "No X available"
    }
  }

  async function loadChemicals() {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        limit,
        offset,
      };
      if (filterSector) params.sector = filterSector;
      if (filterIndustry) params.industry = filterIndustry;
      if (filterVendor) params.vendor = filterVendor;
      if (filterProductCategory) params.product_category = filterProductCategory;
      if (filterSubCategory) params.sub_category = filterSubCategory;
      if (search) params.search = search;

      const res = await fetchChemicalFullData(params);
      setChemicals(res.chemicals);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load chemicals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  // Reload options when create form is opened
  useEffect(() => {
    if (showCreateForm) {
      loadOptions();
    }
  }, [showCreateForm]);

  useEffect(() => {
    loadChemicals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filterSector, filterIndustry, filterVendor, filterProductCategory, filterSubCategory]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
      setOffset(0);
    await loadChemicals();
  }

  function clearFilters() {
    setFilterSector("");
    setFilterIndustry("");
    setFilterVendor("");
    setFilterProductCategory("");
    setFilterSubCategory("");
    setSearch("");
    setOffset(0);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.product_name?.trim()) {
      alert("Product name is required");
      return;
    }

    try {
      setCreating(true);
      // Get next available ID automatically
      const maxId = chemicals.length > 0 ? Math.max(...chemicals.map((c) => c.id)) : 0;
      const createData: ChemicalFullDataCreate & { id: number } = {
        id: maxId + 1,
        sector: formData.sector || null,
        industry: formData.industry || null,
        partner_id: formData.partner_id,
        vendor: formData.vendor || null,
        product_category: formData.product_category || null,
        sub_category: formData.sub_category || null,
        product_name: formData.product_name || null,
        packing: formData.packing || null,
        typical_application: formData.typical_application || null,
        product_description: formData.product_description || null,
        hs_code: formData.hs_code || null,
        price: formData.price,
      };
      await createChemicalFullData(createData);
      setShowCreateForm(false);
      setFormData({
        id: 0,
        sector: "",
        industry: "",
        partner_id: null,
        vendor: "",
        product_category: "",
        sub_category: "",
        product_name: "",
        packing: "",
        typical_application: "",
        product_description: "",
        hs_code: "",
        price: null,
      });
      await loadChemicals();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create chemical");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(chemical: ChemicalFullData) {
    setEditingId(chemical.id);
    setEditData({
      sector: chemical.sector || null,
      industry: chemical.industry || null,
      partner_id: chemical.partner_id || null,
      vendor: chemical.vendor || null,
      product_category: chemical.product_category || null,
      sub_category: chemical.sub_category || null,
      product_name: chemical.product_name || null,
      packing: chemical.packing || null,
      typical_application: chemical.typical_application || null,
      product_description: chemical.product_description || null,
      hs_code: chemical.hs_code || null,
      price: chemical.price || null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData({});
  }

  async function handleUpdate(id: number) {
    try {
      setUpdating(true);
      await updateChemicalFullData(id, editData);
      setEditingId(null);
      setEditData({});
      await loadChemicals();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to update chemical");
    } finally {
      setUpdating(false);
    }
  }

  async function handleViewDetails(id: number) {
    const chemical = chemicals.find((c) => c.id === id);
    if (chemical) {
      setViewingChemical(chemical);
      setViewingId(id);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this chemical? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteChemicalFullData(id);
      await loadChemicals();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to delete chemical");
    } finally {
      setDeletingId(null);
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
                  PMS · Chemical Master Data
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <FlaskConical className="text-blue-400" size={32} />
                Chemical Master Data
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Complete chemical product information from chemical_full_data. View and manage all
                product details including vendor, category, pricing, applications, and more.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-600 text-slate-200 font-semibold transition-all hover:bg-slate-700"
              >
                <Filter size={20} />
                Filters
              </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              {showCreateForm ? "Cancel" : "Add Chemical"}
            </button>
              <Link
                to="/pms/tds"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold transition-all hover:bg-emerald-600 hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 active:translate-y-0"
              >
                <FileText size={20} />
                Upload a TDS
              </Link>
            </div>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Filters</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sector</label>
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sectors</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                <select
                  value={filterIndustry}
                  onChange={(e) => setFilterIndustry(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Industries</option>
                  {industries.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor</label>
                <select
                  value={filterVendor}
                  onChange={(e) => setFilterVendor(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.vendor}>
                      {v.vendor}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Category
                </label>
                <select
                  value={filterProductCategory}
                  onChange={(e) => setFilterProductCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Categories</option>
                  {productCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sub Category
                </label>
                <select
                  value={filterSubCategory}
                  onChange={(e) => setFilterSubCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sub Categories</option>
                  {subCategories.map((sc) => (
                    <option key={sc} value={sc}>
                      {sc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Chemical</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sector {sectors.length > 0 && `(${sectors.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.sector || ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log("Sector changed to:", newValue);
                        setFormData({ ...formData, sector: newValue });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Sector...</option>
                      {sectors.length > 0 ? (
                        sectors.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))
                      ) : (
                        <option disabled>No sectors available</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddOption("sector")}
                      className="p-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      title="Add new sector"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Industry {industries.length > 0 && `(${industries.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.industry || ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log("Industry changed to:", newValue);
                        setFormData({ ...formData, industry: newValue });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Industry...</option>
                      {industries.length > 0 ? (
                        industries.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))
                      ) : (
                        <option disabled>No industries available</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddOption("industry")}
                      className="p-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      title="Add new industry"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Vendor {vendors.length > 0 && `(${vendors.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.partner_id || ""}
                      onChange={(e) => {
                        const selectedPartnerId = e.target.value;
                        const selectedVendor = vendors.find((v) => v.id === selectedPartnerId);
                        console.log("Vendor changed to:", selectedVendor?.vendor, "ID:", selectedPartnerId);
                        setFormData({
                          ...formData,
                          partner_id: selectedPartnerId || null,
                          vendor: selectedVendor?.vendor || "",
                        });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Vendor...</option>
                      {vendors.length > 0 ? (
                        vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.vendor}
                          </option>
                        ))
                      ) : (
                        <option disabled>No vendors available</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddOption("vendor")}
                      className="p-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      title="Add new vendor"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Category {productCategories.length > 0 && `(${productCategories.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.product_category || ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log("Product Category changed to:", newValue);
                        setFormData({ ...formData, product_category: newValue });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Category...</option>
                      {productCategories.length > 0 ? (
                        productCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                      ) : (
                        <option disabled>No categories available</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddOption("product_category")}
                      className="p-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      title="Add new product category"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sub Category {subCategories.length > 0 && `(${subCategories.length})`}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.sub_category || ""}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log("Sub Category changed to:", newValue);
                        setFormData({ ...formData, sub_category: newValue });
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Sub Category...</option>
                      {subCategories.length > 0 ? (
                        subCategories.map((sc) => (
                          <option key={sc} value={sc}>
                            {sc}
                          </option>
                        ))
                      ) : (
                        <option disabled>No sub categories available</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddOption("sub_category")}
                      className="p-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      title="Add new sub category"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.product_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, product_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Packing</label>
                  <input
                    type="text"
                    value={formData.packing || ""}
                    onChange={(e) => setFormData({ ...formData, packing: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 25 KG Bag"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HS Code</label>
                  <input
                    type="text"
                    value={formData.hs_code || ""}
                    onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Harmonized System code"
                  />
                </div>
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) || null })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Typical Application
                </label>
                  <textarea
                    value={formData.typical_application || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, typical_application: e.target.value })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe typical applications..."
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Description
                  </label>
                  <textarea
                    value={formData.product_description || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, product_description: e.target.value })
                    }
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Detailed product description..."
                  />
                  </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Chemical"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      id: 0,
                      sector: "",
                      industry: "",
                      partner_id: null,
                      vendor: "",
                      product_category: "",
                      sub_category: "",
                      product_name: "",
                      packing: "",
                      typical_application: "",
                      product_description: "",
                      hs_code: "",
                      price: null,
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

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, vendor, category, or description..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  loadChemicals();
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
        {loading && chemicals.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : chemicals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No chemicals found</p>
            <p className="text-slate-500 text-sm mt-1">
              {search || filterSector || filterIndustry || filterVendor
                ? "Try adjusting your filters"
                : "Create your first chemical to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Stats and Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{chemicals.length}</span> of{" "}
                <span className="font-semibold">{total}</span> chemicals
              </p>
              <div className="text-sm text-slate-600">
                Total chemicals: <span className="font-semibold">{total}</span>
              </div>
            </div>

            {/* Chemical List - Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Sub Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Operation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
              {chemicals.map((chemical) => (
                      <>
                        <tr
                  key={chemical.id}
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => {
                            if (editingId !== chemical.id) {
                              setExpandedId(expandedId === chemical.id ? null : chemical.id);
                            }
                          }}
                >
                  {editingId === chemical.id ? (
                          // Edit Row
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                              {chemical.id}
                            </td>
                            <td colSpan={7} className="px-6 py-4">
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Sector
                                    </label>
                                    <select
                                      value={editData.sector || ""}
                                      onChange={(e) =>
                                        setEditData({ ...editData, sector: e.target.value || null })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select...</option>
                                      {sectors.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Industry
                                    </label>
                                    <select
                                      value={editData.industry || ""}
                                      onChange={(e) =>
                                        setEditData({
                                          ...editData,
                                          industry: e.target.value || null,
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select...</option>
                                      {industries.map((i) => (
                                        <option key={i} value={i}>
                                          {i}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Vendor
                                    </label>
                                    <select
                                      value={editData.vendor || ""}
                                      onChange={(e) =>
                                        setEditData({ ...editData, vendor: e.target.value || null })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select...</option>
                                      {vendors.map((v) => (
                                        <option key={v.id} value={v.vendor}>
                                          {v.vendor}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Product Category
                                    </label>
                                    <select
                                      value={editData.product_category || ""}
                                      onChange={(e) =>
                                        setEditData({
                                          ...editData,
                                          product_category: e.target.value || null,
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select...</option>
                                      {productCategories.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Sub Category
                                    </label>
                                    <select
                                      value={editData.sub_category || ""}
                                      onChange={(e) =>
                                        setEditData({
                                          ...editData,
                                          sub_category: e.target.value || null,
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      <option value="">Select...</option>
                                      {subCategories.map((sc) => (
                                        <option key={sc} value={sc}>
                                          {sc}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Product Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                                      value={editData.product_name || ""}
                                      onChange={(e) =>
                                        setEditData({ ...editData, product_name: e.target.value })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Packing
                          </label>
                          <input
                            type="text"
                                      value={editData.packing || ""}
                            onChange={(e) =>
                                        setEditData({ ...editData, packing: e.target.value })
                            }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            HS Code
                          </label>
                          <input
                            type="text"
                            value={editData.hs_code || ""}
                            onChange={(e) =>
                              setEditData({ ...editData, hs_code: e.target.value })
                            }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                                      Price
                        </label>
                          <input
                                      type="number"
                                      step="0.01"
                                      value={editData.price || ""}
                                      onChange={(e) =>
                                        setEditData({
                                          ...editData,
                                          price: parseFloat(e.target.value) || null,
                                        })
                                      }
                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                        </div>
                          </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Typical Application
                                  </label>
                                  <textarea
                                    value={editData.typical_application || ""}
                                    onChange={(e) =>
                                      setEditData({
                                        ...editData,
                                        typical_application: e.target.value,
                                      })
                                    }
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-700 mb-1">
                                    Product Description
                                  </label>
                                  <textarea
                                    value={editData.product_description || ""}
                                    onChange={(e) =>
                                      setEditData({
                                        ...editData,
                                        product_description: e.target.value,
                                      })
                                    }
                                    rows={2}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(chemical.id)}
                                    disabled={updating || !editData.product_name?.trim()}
                                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {updating ? (
                            <>
                              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save"
                          )}
                        </button>
                        <button
                          onClick={cancelEdit}
                                    className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                            </td>
                          </>
                        ) : (
                          // View Row
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              {chemical.id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                              {chemical.product_name || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {chemical.vendor || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {chemical.product_category || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                              {chemical.sub_category || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(chemical.id);
                                  }}
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                                  title="View Details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(chemical);
                                  }}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(chemical.id);
                                  }}
                            disabled={deletingId === chemical.id}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === chemical.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId(expandedId === chemical.id ? null : chemical.id);
                                }}
                                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold hover:shadow-lg transition-all"
                              >
                                {expandedId === chemical.id ? "Hide" : "View"}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                      {/* Expanded Details Row */}
                      {expandedId === chemical.id && editingId !== chemical.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                              {chemical.sector && (
                                <div>
                                  <span className="text-slate-500 font-medium">Sector:</span>{" "}
                                  <span className="text-slate-900">{chemical.sector}</span>
                      </div>
                              )}
                              {chemical.industry && (
                          <div>
                                  <span className="text-slate-500 font-medium">Industry:</span>{" "}
                                  <span className="text-slate-900">{chemical.industry}</span>
                                </div>
                              )}
                              {chemical.packing && (
                                <div>
                                  <span className="text-slate-500 font-medium">Packing:</span>{" "}
                                  <span className="text-slate-900">{chemical.packing}</span>
                          </div>
                        )}
                        {chemical.hs_code && (
                          <div>
                                  <span className="text-slate-500 font-medium">HS Code:</span>{" "}
                                  <span className="text-slate-900">{chemical.hs_code}</span>
                          </div>
                        )}
                              {chemical.price !== null && chemical.price !== undefined && (
                          <div>
                                  <span className="text-slate-500 font-medium">Price:</span>{" "}
                                  <span className="text-slate-900">
                                    ${chemical.price.toFixed(2)}
                                </span>
                                </div>
                              )}
                              {chemical.partner_id && (
                                <div>
                                  <span className="text-slate-500 font-medium">Partner ID:</span>{" "}
                                  <span className="text-slate-900">{chemical.partner_id}</span>
                            </div>
                              )}
                            </div>
                            {(chemical.typical_application || chemical.product_description) && (
                              <div className="mt-4 space-y-2">
                                {chemical.typical_application && (
                                  <div>
                                    <span className="text-slate-500 font-medium">
                                      Typical Application:
                                    </span>
                                    <p className="text-slate-900 mt-1">
                                      {chemical.typical_application}
                                    </p>
                          </div>
                        )}
                                {chemical.product_description && (
                                  <div>
                                    <span className="text-slate-500 font-medium">
                                      Product Description:
                                    </span>
                                    <p className="text-slate-900 mt-1">
                                      {chemical.product_description}
                                    </p>
                      </div>
                  )}
                </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </>
              ))}
                  </tbody>
                </table>
              </div>
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

      {/* View Details Modal */}
      {viewingId && viewingChemical && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                {viewingChemical.product_name || `Chemical #${viewingChemical.id}`}
              </h2>
              <button
                onClick={() => {
                  setViewingId(null);
                  setViewingChemical(null);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                    ID
                  </label>
                  <p className="text-slate-900 font-medium">{viewingChemical.id}</p>
                </div>
                {viewingChemical.sector && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Sector
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.sector}</p>
                  </div>
                )}
                {viewingChemical.industry && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Industry
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.industry}</p>
                  </div>
                )}
                {viewingChemical.vendor && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Vendor
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.vendor}</p>
                  </div>
                )}
                {viewingChemical.product_category && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Product Category
                    </label>
                    <p className="text-slate-900 font-medium">
                      {viewingChemical.product_category}
                    </p>
                  </div>
                )}
                {viewingChemical.sub_category && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Sub Category
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.sub_category}</p>
                  </div>
                )}
                {viewingChemical.product_name && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Product Name
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.product_name}</p>
                  </div>
                )}
                {viewingChemical.packing && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Packing
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.packing}</p>
                  </div>
                )}
                {viewingChemical.hs_code && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      HS Code
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.hs_code}</p>
                  </div>
                )}
                {viewingChemical.price !== null &&
                  viewingChemical.price !== undefined && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                        Price
                      </label>
                      <p className="text-slate-900 font-medium">
                        ${viewingChemical.price.toFixed(2)}
                      </p>
                    </div>
                  )}
                {viewingChemical.partner_id && (
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
                      Partner ID
                    </label>
                    <p className="text-slate-900 font-medium">{viewingChemical.partner_id}</p>
                  </div>
                )}
              </div>
              {viewingChemical.typical_application && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                    Typical Application
                  </label>
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {viewingChemical.typical_application}
                  </p>
                </div>
              )}
              {viewingChemical.product_description && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                    Product Description
                  </label>
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {viewingChemical.product_description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {addOptionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Add new{" "}
                {addOptionType === "product_category"
                  ? "product category"
                  : addOptionType === "sub_category"
                    ? "sub category"
                    : addOptionType}
              </h3>
              <button
                type="button"
                onClick={closeAddOption}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                <input
                  autoFocus
                  type="text"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveNewOption();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      closeAddOption();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Type new value..."
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeAddOption}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNewOption}
                  disabled={!newOptionValue.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
