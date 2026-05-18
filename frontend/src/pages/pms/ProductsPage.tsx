import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchChemicalFullData,
  createChemicalFullData,
  ChemicalFullData,
  ChemicalFullDataCreate,
  fetchSectors,
  fetchIndustries,
  fetchPartnerChemicals,
  fetchProductCategoriesFullData,
  fetchSubCategoriesFullData,
  fetchProductNames,
  createPartnerChemical,
  PartnerChemicalCreate,
} from "../../services/api";
import {
  Building2,
  Search,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Filter,
  X,
} from "lucide-react";

export function ProductsPage() {
  const [products, setProducts] = useState<ChemicalFullData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters
  const [searchSector, setSearchSector] = useState("");
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchVendor, setSearchVendor] = useState("");
  const [searchProductCategory, setSearchProductCategory] = useState("");
  const [searchSubCategory, setSearchSubCategory] = useState("");

  // Options for dropdowns
  const [sectors, setSectors] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Array<{ id: string; vendor: string }>>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [productNames, setProductNames] = useState<string[]>([]);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<ChemicalFullDataCreate>({
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

  // Add new value modals
  const [showAddSector, setShowAddSector] = useState(false);
  const [showAddIndustry, setShowAddIndustry] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSubCategory, setShowAddSubCategory] = useState(false);
  const [showAddProductName, setShowAddProductName] = useState(false);
  const [newValue, setNewValue] = useState("");

  async function loadOptions() {
    try {
      const [sectorsRes, industriesRes, vendorsRes, categoriesRes, subCategoriesRes, namesRes] =
        await Promise.all([
          fetchSectors(),
          fetchIndustries(),
          fetchPartnerChemicals({ limit: 1000 }),
          fetchProductCategoriesFullData(),
          fetchSubCategoriesFullData(),
          fetchProductNames(),
        ]);
      setSectors(sectorsRes);
      setIndustries(industriesRes);
      setVendors(
        vendorsRes.partner_chemicals.map((pc) => ({
          id: pc.id,
          vendor: pc.vendor,
        }))
      );
      setProductCategories(categoriesRes);
      setSubCategories(subCategoriesRes);
      setProductNames(namesRes);
    } catch (err) {
      console.error("Failed to load options:", err);
    }
  }

  async function loadProducts() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchChemicalFullData({
        limit,
        offset,
        sector: searchSector || undefined,
        industry: searchIndustry || undefined,
        vendor: searchVendor || undefined,
        product_category: searchProductCategory || undefined,
        sub_category: searchSubCategory || undefined,
      });
      setProducts(res.chemicals);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, searchSector, searchIndustry, searchVendor, searchProductCategory, searchSubCategory]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      await createChemicalFullData(formData);
      setShowCreateForm(false);
      setFormData({
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
      await loadProducts();
      await loadOptions();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create product");
    } finally {
      setCreating(false);
    }
  }

  async function handleAddNewValue(type: string) {
    if (!newValue.trim()) return;

    try {
      if (type === "vendor") {
        // Create a new partner_chemical
        const newPartner: PartnerChemicalCreate = {
          vendor: newValue.trim(),
          product_category: "",
          product_name: "",
          packing: "",
        };
        await createPartnerChemical(newPartner);
        await loadOptions();
        setFormData({ ...formData, vendor: newValue.trim() });
      } else {
        // For other fields, just add to the local list and use it
        if (type === "sector") {
          setSectors([...sectors, newValue.trim()].sort());
          setFormData({ ...formData, sector: newValue.trim() });
        } else if (type === "industry") {
          setIndustries([...industries, newValue.trim()].sort());
          setFormData({ ...formData, industry: newValue.trim() });
        } else if (type === "category") {
          setProductCategories([...productCategories, newValue.trim()].sort());
          setFormData({ ...formData, product_category: newValue.trim() });
        } else if (type === "subCategory") {
          setSubCategories([...subCategories, newValue.trim()].sort());
          setFormData({ ...formData, sub_category: newValue.trim() });
        } else if (type === "productName") {
          setProductNames([...productNames, newValue.trim()].sort());
          setFormData({ ...formData, product_name: newValue.trim() });
        }
      }
      setNewValue("");
      if (type === "sector") setShowAddSector(false);
      if (type === "industry") setShowAddIndustry(false);
      if (type === "vendor") setShowAddVendor(false);
      if (type === "category") setShowAddCategory(false);
      if (type === "subCategory") setShowAddSubCategory(false);
      if (type === "productName") setShowAddProductName(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to add new value");
    }
  }

  function clearFilters() {
    setSearchSector("");
    setSearchIndustry("");
    setSearchVendor("");
    setSearchProductCategory("");
    setSearchSubCategory("");
    setOffset(0);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters =
    searchSector || searchIndustry || searchVendor || searchProductCategory || searchSubCategory;

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
                  PMS · Chemical Products
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <Building2 className="text-indigo-400" size={32} />
                Chemical Products
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Manage chemical products catalog. Create products with sector, industry, vendor,
                category, and product details.
              </p>
            </div>

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              {showCreateForm ? "Cancel" : "Add Product"}
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New Product</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Step 1: Sector and Industry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sector <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.sector || ""}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select Sector...</option>
                      {sectors.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddSector(true)}
                      className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add new sector"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Industry <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.industry || ""}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select Industry...</option>
                      {industries.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddIndustry(true)}
                      className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add new industry"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Vendor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.partner_id || ""}
                    onChange={(e) => {
                      const selected = vendors.find((v) => v.id === e.target.value);
                      setFormData({
                        ...formData,
                        partner_id: e.target.value || null,
                        vendor: selected?.vendor || "",
                      });
                    }}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vendor}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddVendor(true)}
                    className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Add new vendor"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Step 3: Product Category and Sub Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Category <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.product_category || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, product_category: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Select Category...</option>
                      {productCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddCategory(true)}
                      className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add new category"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sub Category
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.sub_category || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, sub_category: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Sub Category...</option>
                      {subCategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddSubCategory(true)}
                      className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Add new sub category"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 4: Product Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.product_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, product_name: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select Product Name...</option>
                    {productNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddProductName(true)}
                    className="px-3 py-2 rounded-lg border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Add new product name"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Step 5: Other Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Packing <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.packing || ""}
                    onChange={(e) => setFormData({ ...formData, packing: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 25kg bag"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">HS Code</label>
                  <input
                    type="text"
                    value={formData.hs_code || ""}
                    onChange={(e) => setFormData({ ...formData, hs_code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., 3824.90.90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Typical Application
                  </label>
                  <input
                    type="text"
                    value={formData.typical_application || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, typical_application: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Construction, Manufacturing"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Description
                </label>
                <textarea
                  value={formData.product_description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, product_description: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Detailed product description..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Product"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
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

        {/* Add New Value Modals */}
        {showAddSector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Sector</h3>
                <button
                  onClick={() => {
                    setShowAddSector(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter sector name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("sector");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("sector")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddSector(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddIndustry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Industry</h3>
                <button
                  onClick={() => {
                    setShowAddIndustry(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter industry name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("industry");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("industry")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddIndustry(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddVendor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Vendor</h3>
                <button
                  onClick={() => {
                    setShowAddVendor(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter vendor name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("vendor");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("vendor")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddVendor(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Category</h3>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter category name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("category");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("category")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddSubCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Sub Category</h3>
                <button
                  onClick={() => {
                    setShowAddSubCategory(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter sub category name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("subCategory");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("subCategory")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddSubCategory(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddProductName && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Add New Product Name</h3>
                <button
                  onClick={() => {
                    setShowAddProductName(false);
                    setNewValue("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter product name"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewValue("productName");
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewValue("productName")}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddProductName(false);
                    setNewValue("");
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sector</label>
              <input
                type="text"
                value={searchSector}
                onChange={(e) => {
                  setSearchSector(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by sector..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
              <input
                type="text"
                value={searchIndustry}
                onChange={(e) => {
                  setSearchIndustry(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by industry..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vendor</label>
              <input
                type="text"
                value={searchVendor}
                onChange={(e) => {
                  setSearchVendor(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by vendor..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <input
                type="text"
                value={searchProductCategory}
                onChange={(e) => {
                  setSearchProductCategory(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by category..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sub Category</label>
              <input
                type="text"
                value={searchSubCategory}
                onChange={(e) => {
                  setSearchSubCategory(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by sub category..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No products found</p>
            <p className="text-slate-500 text-sm mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "Create your first product to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{products.length}</span> of{" "}
                <span className="font-semibold">{total}</span> products
              </p>
            </div>

            {/* Products List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900">
                      {product.product_name || "Unnamed Product"}
                      </h3>
                      <Building2 className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    </div>

                    <div className="space-y-2 text-sm">
                    {product.sector && (
                      <div>
                        <span className="text-slate-500">Sector:</span>{" "}
                        <span className="font-medium text-slate-700">{product.sector}</span>
                      </div>
                    )}
                    {product.industry && (
                      <div>
                        <span className="text-slate-500">Industry:</span>{" "}
                        <span className="font-medium text-slate-700">{product.industry}</span>
                      </div>
                    )}
                    {product.vendor && (
                      <div>
                        <span className="text-slate-500">Vendor:</span>{" "}
                        <span className="font-medium text-slate-700">{product.vendor}</span>
                      </div>
                    )}
                    {product.product_category && (
                        <div>
                          <span className="text-slate-500">Category:</span>{" "}
                        <span className="font-medium text-slate-700">{product.product_category}</span>
                      </div>
                    )}
                    {product.sub_category && (
                      <div>
                        <span className="text-slate-500">Sub Category:</span>{" "}
                        <span className="font-medium text-slate-700">{product.sub_category}</span>
                        </div>
                      )}
                    {product.packing && (
                        <div>
                        <span className="text-slate-500">Packing:</span>{" "}
                        <span className="font-medium text-slate-700">{product.packing}</span>
                        </div>
                      )}
                    {product.price && (
                        <div>
                        <span className="text-slate-500">Price:</span>{" "}
                        <span className="font-medium text-slate-700">${product.price.toFixed(2)}</span>
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
