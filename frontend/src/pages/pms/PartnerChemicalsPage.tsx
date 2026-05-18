import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  api,
  fetchPartnerChemicals,
  createPartnerChemical,
  updatePartnerChemical,
  deletePartnerChemical,
  fetchVendors,
  fetchProductCategories,
  fetchSubCategories,
  fetchTDS,
  PartnerChemical,
  PartnerChemicalCreate,
  PartnerChemicalUpdate,
} from "../../services/api";
import { Plus, Edit, Trash2, X, Save, Search, Filter, ChevronDown, ChevronRight, Building2 } from "lucide-react";

export function PartnerChemicalsPage() {
  const [partnerChemicals, setPartnerChemicals] = useState<PartnerChemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PartnerChemicalCreate>({
    vendor: "",
    product_category: "",
    sub_category: "",
    product_name: "",
    brand: "",
    packing: "",
    price: null,
    competitive_price: null,
    cost: null,
    tds_id: null,
  });
  
  // Dropdown options
  const [vendors, setVendors] = useState<string[]>([]);
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [newVendor, setNewVendor] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubCategory, setNewSubCategory] = useState("");
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSubCategory, setShowNewSubCategory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      const [chemicalsRes, vendorsRes, categoriesRes, subCategoriesRes] = await Promise.all([
        fetchPartnerChemicals({ limit: 1000 }),
        fetchVendors(),
        fetchProductCategories(),
        fetchSubCategories(),
      ]);
      
      setPartnerChemicals(chemicalsRes.partner_chemicals);
      setVendors(vendorsRes);
      setProductCategories(categoriesRes);
      setSubCategories(subCategoriesRes);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err?.message || "Failed to load partner chemicals");
    } finally {
      setLoading(false);
    }
  }

  function handleAddNew() {
    setEditingId(null);
    setFormData({
      vendor: "",
      product_category: "",
      sub_category: "",
      product_name: "",
      brand: "",
      packing: "",
      price: null,
      competitive_price: null,
      cost: null,
      tds_id: null,
    });
    setNewVendor("");
    setNewCategory("");
    setNewSubCategory("");
    setShowNewVendor(false);
    setShowNewCategory(false);
    setShowNewSubCategory(false);
    setShowForm(true);
  }

  function handleEdit(chemical: PartnerChemical) {
    setEditingId(chemical.id);
    setFormData({
      vendor: chemical.vendor,
      product_category: chemical.product_category,
      sub_category: chemical.sub_category || "",
      product_name: chemical.product_name,
      brand: chemical.brand || "",
      packing: chemical.packing,
      price: chemical.price || null,
      competitive_price: chemical.competitive_price || null,
      cost: chemical.cost || null,
      tds_id: chemical.tds_id || null,
    });
    setNewVendor("");
    setNewCategory("");
    setNewSubCategory("");
    setShowNewVendor(false);
    setShowNewCategory(false);
    setShowNewSubCategory(false);
    setShowForm(true);
  }

  async function handleSave() {
    try {
      if (!formData.vendor || !formData.product_category || !formData.product_name || !formData.packing) {
        alert("Please fill in all required fields (Vendor, Product Category, Product Name, Packing)");
        return;
      }

      // Use new vendor/category/subcategory if provided
      const finalVendor = showNewVendor && newVendor ? newVendor : formData.vendor;
      const finalCategory = showNewCategory && newCategory ? newCategory : formData.product_category;
      const finalSubCategory = showNewSubCategory && newSubCategory ? newSubCategory : formData.sub_category;

      const dataToSave: PartnerChemicalCreate = {
        ...formData,
        vendor: finalVendor,
        product_category: finalCategory,
        sub_category: finalSubCategory || null,
      };

      if (editingId) {
        await updatePartnerChemical(editingId, dataToSave as PartnerChemicalUpdate);
      } else {
        await createPartnerChemical(dataToSave);
      }

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      console.error("Error saving:", err);
      alert(err?.response?.data?.detail || "Failed to save partner chemical");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this partner chemical?")) {
      return;
    }

    try {
      await deletePartnerChemical(id);
      await loadData();
    } catch (err: any) {
      console.error("Error deleting:", err);
      alert(err?.response?.data?.detail || "Failed to delete partner chemical");
    }
  }

  // Auto-link TDS based on brand and product name
  async function handleAutoLinkTDS() {
    if (!formData.product_name || !formData.brand) {
      alert("Please provide both Product Name and Brand to auto-link TDS");
      return;
    }
    
    try {
      // Search for TDS records that match both product name and brand
      const tdsRes = await fetchTDS({ limit: 1000 });
      const matchingTds = tdsRes.tds.find(
        (tds) => {
          const tdsBrand = (tds.brand || "").toLowerCase().trim();
          const tdsProductName = (tds.metadata?.product_name || tds.metadata?.generic_product_name || "").toLowerCase().trim();
          const formBrand = (formData.brand || "").toLowerCase().trim();
          const formProductName = (formData.product_name || "").toLowerCase().trim();
          
          // Match both brand and product name
          return tdsBrand === formBrand && 
                 (tdsProductName === formProductName || 
                  tdsProductName.includes(formProductName) || 
                  formProductName.includes(tdsProductName));
        }
      );
      
      if (matchingTds) {
        setFormData({ ...formData, tds_id: matchingTds.id });
        alert(`TDS linked successfully!`);
      } else {
        alert("No matching TDS found. Please ensure both Product Name and Brand match a TDS record.");
      }
    } catch (err) {
      console.error("Error auto-linking TDS:", err);
      alert("Error auto-linking TDS. Please try again.");
    }
  }

  // Find matching TDS for a chemical (for display)
  const [tdsMap, setTdsMap] = useState<Map<string, { id: string; url?: string }>>(new Map());
  
  useEffect(() => {
    async function loadTDSMappings() {
      try {
        const tdsRes = await fetchTDS({ limit: 1000 });
        const map = new Map<string, { id: string; url?: string }>();
        
        partnerChemicals.forEach((chem) => {
          if (chem.product_name && chem.brand) {
            const matchingTds = tdsRes.tds.find(
              (tds) => {
                const tdsBrand = (tds.brand || "").toLowerCase().trim();
                const tdsProductName = (tds.metadata?.product_name || tds.metadata?.generic_product_name || "").toLowerCase().trim();
                const chemBrand = (chem.brand || "").toLowerCase().trim();
                const chemProductName = (chem.product_name || "").toLowerCase().trim();
                
                return tdsBrand === chemBrand && 
                       (tdsProductName === chemProductName || 
                        tdsProductName.includes(chemProductName) || 
                        chemProductName.includes(tdsProductName));
              }
            );
            
            if (matchingTds) {
              map.set(chem.id, {
                id: matchingTds.id,
                url: matchingTds.metadata?.tds_file_url,
              });
            }
          }
        });
        
        setTdsMap(map);
      } catch (err) {
        console.error("Error loading TDS mappings:", err);
      }
    }
    
    if (partnerChemicals.length > 0) {
      loadTDSMappings();
    }
  }, [partnerChemicals]);

  const filteredChemicals = partnerChemicals.filter((chem) => {
    const matchesSearch =
      !searchQuery ||
      chem.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chem.product_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chem.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chem.packing.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesVendor = !filterVendor || chem.vendor === filterVendor;
    const matchesCategory = !filterCategory || chem.product_category === filterCategory;
    
    return matchesSearch && matchesVendor && matchesCategory;
  });

  // Group chemicals by vendor
  const chemicalsByVendor = filteredChemicals.reduce((acc, chem) => {
    if (!acc[chem.vendor]) {
      acc[chem.vendor] = [];
    }
    acc[chem.vendor].push(chem);
    return acc;
  }, {} as Record<string, PartnerChemical[]>);

  const vendorList = Object.keys(chemicalsByVendor).sort();

  function toggleVendor(vendor: string) {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) {
        next.delete(vendor);
      } else {
        next.add(vendor);
      }
      return next;
    });
  }

  function expandAllVendors() {
    setExpandedVendors(new Set(vendorList));
  }

  function collapseAllVendors() {
    setExpandedVendors(new Set());
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading partner chemicals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Partner Chemicals</h1>
              <p className="text-slate-600 mt-1">Manage partner chemical information</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/pms"
                className="px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Back to PMS
              </Link>
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by vendor, category, product name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Vendor</label>
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filter by Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="">All Categories</option>
                {productCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {vendorList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-sm text-slate-600">Total Vendors</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{vendorList.length}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="text-sm text-slate-600">Total Chemicals</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{filteredChemicals.length}</div>
            </div>
          </div>
        )}

        {/* Vendor Groups */}
        <div className="space-y-4">
          {vendorList.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No partner chemicals found</p>
            </div>
          ) : (
            <>
              {/* Expand/Collapse All Buttons */}
              <div className="flex justify-end gap-2 mb-4">
                <button
                  onClick={expandAllVendors}
                  className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAllVendors}
                  className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Collapse All
                </button>
              </div>

              {/* Vendor Groups */}
              {vendorList.map((vendor) => {
                const chemicals = chemicalsByVendor[vendor];
                const isExpanded = expandedVendors.has(vendor);
                
                return (
                  <div
                    key={vendor}
                    className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                  >
                    {/* Vendor Header */}
                    <button
                      onClick={() => toggleVendor(vendor)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-600" />
                        )}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-slate-900 text-lg">{vendor}</div>
                            <div className="text-sm text-slate-600">
                              {chemicals.length} chemical{chemicals.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {/* Chemicals List */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 bg-slate-50">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-100">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Product Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Sub Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Product Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Brand
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Packing
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Price
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Competitive Price
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Cost
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  TDS
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {chemicals.map((chem) => {
                                const tdsInfo = tdsMap.get(chem.id);
                                const hasTDS = tdsInfo && chem.product_name && chem.brand;
                                
                                return (
                                  <tr key={chem.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                      {chem.product_category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                      {chem.sub_category || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                      {chem.product_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                      {chem.brand || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">{chem.packing}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                      {chem.price ? `$${chem.price.toFixed(2)}` : "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                      {chem.competitive_price ? `$${chem.competitive_price.toFixed(2)}` : "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                      {chem.cost ? `$${chem.cost.toFixed(2)}` : "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      {hasTDS ? (
                                        <a
                                          href={tdsInfo.url || `/pms/tds/${tdsInfo.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:text-blue-800 underline"
                                          title="View TDS"
                                        >
                                          View TDS
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleEdit(chem)}
                                          className="text-emerald-600 hover:text-emerald-900"
                                          title="Edit"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDelete(chem.id)}
                                          className="text-red-600 hover:text-red-900"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? "Edit Partner Chemical" : "Add Partner Chemical"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vendor <span className="text-red-500">*</span>
                </label>
                {!showNewVendor ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewVendor(true)}
                      className="px-4 py-2 text-sm text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50"
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new vendor name"
                      value={newVendor}
                      onChange={(e) => setNewVendor(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewVendor(false);
                        setNewVendor("");
                      }}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Product Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Category <span className="text-red-500">*</span>
                </label>
                {!showNewCategory ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.product_category}
                      onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select Category</option>
                      {productCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewCategory(true)}
                      className="px-4 py-2 text-sm text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50"
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategory("");
                      }}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Sub Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub Category</label>
                {!showNewSubCategory ? (
                  <div className="flex gap-2">
                    <select
                      value={formData.sub_category || ""}
                      onChange={(e) => setFormData({ ...formData, sub_category: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">Select Sub Category (Optional)</option>
                      {subCategories.map((sc) => (
                        <option key={sc} value={sc}>
                          {sc}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewSubCategory(true)}
                      className="px-4 py-2 text-sm text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50"
                    >
                      + New
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter new sub category"
                      value={newSubCategory}
                      onChange={(e) => setNewSubCategory(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewSubCategory(false);
                        setNewSubCategory("");
                      }}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              {/* Brand */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={formData.brand || ""}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter brand name"
                />
                <p className="text-xs text-slate-500 mt-1">Required for TDS auto-linking (must match both brand and product name)</p>
              </div>

              {/* Packing */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Packing <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.packing}
                  onChange={(e) => setFormData({ ...formData, packing: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  placeholder="From PMS pricing"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">Will be taken from PMS pricing (to be implemented)</p>
              </div>

              {/* Competitive Price */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Competitive Price (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.competitive_price || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      competitive_price: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Cost */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value ? parseFloat(e.target.value) : null })
                  }
                  placeholder="From pricing"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">Will be taken from pricing (to be implemented)</p>
              </div>

              {/* TDS Link */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">TDS Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.tds_id || ""}
                    onChange={(e) => setFormData({ ...formData, tds_id: e.target.value || null })}
                    placeholder="Auto-linked based on brand and product"
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAutoLinkTDS}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    Auto-Link
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Auto-links TDS when both Product Name and Brand match a TDS record</p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


