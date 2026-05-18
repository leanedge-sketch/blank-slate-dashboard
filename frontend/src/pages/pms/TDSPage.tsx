import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  fetchTDS,
  fetchTDSById,
  createTDS,
  fetchChemicalTypes,
  Tds,
  TdsCreate,
  ChemicalType,
} from "../../services/api";
import {
  FileText,
  Search,
  Plus,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Package,
  Filter,
  Upload,
  Sparkles,
  ExternalLink,
  Calendar,
  User,
  Building2,
  FileCheck,
  Info,
} from "lucide-react";

export function TDSPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters - initialize from URL params if present
  const [searchBrand, setSearchBrand] = useState(searchParams.get("brand") || "");
  const [searchGrade, setSearchGrade] = useState(searchParams.get("grade") || "");
  const [searchOwner, setSearchOwner] = useState(searchParams.get("owner") || "");
  const [selectedChemicalType, setSelectedChemicalType] = useState<string>(searchParams.get("chemical_type_id") || "");

  // Chemical types for dropdown
  const [chemicalTypes, setChemicalTypes] = useState<ChemicalType[]>([]);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<TdsCreate>({
    chemical_type_id: null,
    brand: "",
    grade: "",
    owner: "",
    source: "",
  });

  // AI extraction state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  // Detail view state
  const [selectedTdsId, setSelectedTdsId] = useState<string | null>(null);
  const [selectedTdsDetail, setSelectedTdsDetail] = useState<Tds | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadChemicalTypes() {
    try {
      const res = await fetchChemicalTypes({ limit: 500 });
      setChemicalTypes(res.chemicals);
    } catch (err) {
      console.error("Failed to load chemical types:", err);
    }
  }

  async function loadTDS() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTDS({
        limit,
        offset,
        brand: searchBrand || undefined,
        grade: searchGrade || undefined,
        owner: searchOwner || undefined,
        chemical_type_id: selectedChemicalType || undefined,
      });
      setTdsList(res.tds);
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load TDS records");
    } finally {
      setLoading(false);
    }
  }

  // Initialize filters from URL params on mount
  useEffect(() => {
    const brand = searchParams.get("brand");
    const grade = searchParams.get("grade");
    const owner = searchParams.get("owner");
    const chemicalTypeId = searchParams.get("chemical_type_id");
    
    if (brand) setSearchBrand(brand);
    if (grade) setSearchGrade(grade);
    if (owner) setSearchOwner(owner);
    if (chemicalTypeId) setSelectedChemicalType(chemicalTypeId);
  }, [searchParams]);

  useEffect(() => {
    loadChemicalTypes();
  }, []);

  useEffect(() => {
    loadTDS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, searchBrand, searchGrade, searchOwner, selectedChemicalType]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
        return;
      }
      setSelectedFile(file);
      setExtractedData(null);
    }
  }

  async function handleAIExtraction() {
    if (!selectedFile) {
      alert("Please select a file first");
      return;
    }

    try {
      setExtracting(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/pms/tds/extract-ai", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = res.data;
      setExtractedData(data);

      // Auto-populate form fields
      setFormData({
        ...formData,
        brand: data.trade_name || data.brand || formData.brand,
        grade: data.grade || formData.grade,
        owner: data.supplier_name || data.owner || formData.owner,
        source: data.source || formData.source,
      });

      // Try to match chemical type by name if available
      if (data.generic_product_name && chemicalTypes.length > 0) {
        const matched = chemicalTypes.find(
          (ct) =>
            ct.name.toLowerCase().includes(data.generic_product_name.toLowerCase()) ||
            data.generic_product_name.toLowerCase().includes(ct.name.toLowerCase())
        );
        if (matched) {
          setFormData((prev) => ({
            ...prev,
            chemical_type_id: matched.id,
          }));
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "AI extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      
      // Include file URL in metadata if extracted
      const metadata = extractedData?.file_url
        ? {
            file_url: extractedData.file_url,
            file_name: extractedData.file_name || selectedFile?.name,
            file_type: extractedData.file_type || extractedData.file_content_type,
            temp_file_key: extractedData.temp_file_key, // For moving file to final location
            extracted_at: new Date().toISOString(),
          }
        : undefined;

      await createTDS({
        ...formData,
        chemical_type_id: formData.chemical_type_id || null,
        metadata: metadata,
      });
      setShowCreateForm(false);
      setFormData({
        chemical_type_id: null,
        brand: "",
        grade: "",
        owner: "",
        source: "",
      });
      setSelectedFile(null);
      setExtractedData(null);
      await loadTDS();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create TDS record");
    } finally {
      setCreating(false);
    }
  }

  function clearFilters() {
    setSearchBrand("");
    setSearchGrade("");
    setSearchOwner("");
    setSelectedChemicalType("");
    setOffset(0);
  }

  async function handleTdsClick(tdsId: string) {
    setSelectedTdsId(tdsId);
    setLoadingDetail(true);
    try {
      const detail = await fetchTDSById(tdsId);
      setSelectedTdsDetail(detail);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to load TDS details");
      setSelectedTdsId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetailView() {
    setSelectedTdsId(null);
    setSelectedTdsDetail(null);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters = searchBrand || searchGrade || searchOwner || selectedChemicalType;

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
                  PMS · TDS Master Data
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <FileText className="text-emerald-400" size={32} />
                TDS Master Data
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Handle Technical Data Sheets & supplier information. Manage brand, grade, owner, and
                source details.
              </p>
            </div>

            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              {showCreateForm ? "Cancel" : "Add TDS"}
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Create New TDS Record</h2>

            {/* AI File Upload Section */}
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-900">AI-Powered Extraction</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Upload a TDS file (PDF, DOCX, XLSX, TXT) and let AI extract the information
                automatically.
              </p>
              <div className="flex gap-3">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.xlsx,.xls,.txt"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-700">
                      {selectedFile ? selectedFile.name : "Choose TDS file..."}
                    </span>
                  </div>
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={handleAIExtraction}
                    disabled={extracting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Extract with AI
                      </>
                    )}
                  </button>
                )}
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setExtractedData(null);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {extractedData && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-100 border border-emerald-300">
                  <p className="text-sm font-semibold text-emerald-900 mb-2">
                    ✅ AI Extraction Complete
                  </p>
                  <div className="text-xs text-emerald-800 space-y-1">
                    {extractedData.generic_product_name && (
                      <p>Product: {extractedData.generic_product_name}</p>
                    )}
                    {extractedData.trade_name && <p>Trade Name: {extractedData.trade_name}</p>}
                    {extractedData.supplier_name && (
                      <p>Supplier: {extractedData.supplier_name}</p>
                    )}
                    {extractedData.file_url && (
                      <p className="mt-2 pt-2 border-t border-emerald-300">
                        📄 File uploaded to:{" "}
                        <a
                          href={extractedData.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {extractedData.file_name || "View file"}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Chemical Type
                  </label>
                  <select
                    value={formData.chemical_type_id || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        chemical_type_id: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select chemical type...</option>
                    {chemicalTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.name} {ct.category ? `(${ct.category})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand || ""}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
                  <input
                    type="text"
                    value={formData.grade || ""}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={formData.owner || ""}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
                  <input
                    type="text"
                    value={formData.source || ""}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create TDS"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({
                      chemical_type_id: null,
                      brand: "",
                      grade: "",
                      owner: "",
                      source: "",
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
              <input
                type="text"
                value={searchBrand}
                onChange={(e) => {
                  setSearchBrand(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by brand..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grade</label>
              <input
                type="text"
                value={searchGrade}
                onChange={(e) => {
                  setSearchGrade(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by grade..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
              <input
                type="text"
                value={searchOwner}
                onChange={(e) => {
                  setSearchOwner(e.target.value);
                  setOffset(0);
                }}
                placeholder="Filter by owner..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Chemical Type
              </label>
              <select
                value={selectedChemicalType}
                onChange={(e) => {
                  setSelectedChemicalType(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">All types</option>
                {chemicalTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
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
        {loading && tdsList.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : tdsList.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No TDS records found</p>
            <p className="text-slate-500 text-sm mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "Create your first TDS record to get started"}
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold">{tdsList.length}</span> of{" "}
                <span className="font-semibold">{total}</span> TDS records
              </p>
            </div>

            {/* TDS List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tdsList.map((tds) => {
                const chemicalType = chemicalTypes.find((ct) => ct.id === tds.chemical_type_id);
                return (
                  <div
                    key={tds.id}
                    onClick={() => handleTdsClick(tds.id)}
                    className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all cursor-pointer hover:border-emerald-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900">
                        {tds.brand || "Unnamed Brand"}
                      </h3>
                      <FileText className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    </div>

                    <div className="space-y-2 text-sm">
                      {chemicalType && (
                        <div>
                          <span className="text-slate-500">Chemical:</span>{" "}
                          <span className="font-medium text-slate-700">{chemicalType.name}</span>
                        </div>
                      )}
                      {tds.grade && (
                        <div>
                          <span className="text-slate-500">Grade:</span>{" "}
                          <span className="font-medium text-slate-700">{tds.grade}</span>
                        </div>
                      )}
                      {tds.owner && (
                        <div>
                          <span className="text-slate-500">Owner:</span>{" "}
                          <span className="font-medium text-slate-700">{tds.owner}</span>
                        </div>
                      )}
                      {tds.source && (
                        <div>
                          <span className="text-slate-500">Source:</span>{" "}
                          <span className="font-medium text-slate-700">{tds.source}</span>
                        </div>
                      )}
                      {tds.metadata &&
                        typeof tds.metadata === "object" &&
                        tds.metadata.file_url && (
                          <div>
                            <span className="text-slate-500">Document:</span>{" "}
                            <a
                              href={tds.metadata.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {tds.metadata.file_name || "View TDS file"}
                            </a>
                          </div>
                        )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <p className="text-xs text-slate-400">Click to view details</p>
                    </div>
                  </div>
                );
              })}
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

      {/* TDS Detail Modal */}
      {selectedTdsId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeDetailView}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : selectedTdsDetail ? (
              <div className="p-6 lg:p-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-slate-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-6 h-6 text-emerald-500" />
                      <h2 className="text-2xl font-bold text-slate-900">
                        {selectedTdsDetail.brand || "Unnamed Brand"}
                      </h2>
                    </div>
                    {selectedTdsDetail.grade && (
                      <p className="text-slate-600">Grade: {selectedTdsDetail.grade}</p>
                    )}
                  </div>
                  <button
                    onClick={closeDetailView}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Info className="w-5 h-5 text-emerald-500" />
                      Basic Information
                    </h3>
                    <div className="space-y-3">
                      {selectedTdsDetail.chemical_type_id && (
                        <div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <Package className="w-4 h-4" />
                            Chemical Type
                          </div>
                          <p className="text-slate-900 font-medium">
                            {chemicalTypes.find((ct) => ct.id === selectedTdsDetail.chemical_type_id)
                              ?.name || "Unknown"}
                          </p>
                        </div>
                      )}
                      {selectedTdsDetail.owner && (
                        <div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <Building2 className="w-4 h-4" />
                            Owner
                          </div>
                          <p className="text-slate-900 font-medium">{selectedTdsDetail.owner}</p>
                        </div>
                      )}
                      {selectedTdsDetail.source && (
                        <div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <FileCheck className="w-4 h-4" />
                            Source
                          </div>
                          <p className="text-slate-900 font-medium">{selectedTdsDetail.source}</p>
                        </div>
                      )}
                      {selectedTdsDetail.created_at && (
                        <div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                            <Calendar className="w-4 h-4" />
                            Created
                          </div>
                          <p className="text-slate-900 font-medium">
                            {new Date(selectedTdsDetail.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Information */}
                  {selectedTdsDetail.metadata &&
                    typeof selectedTdsDetail.metadata === "object" &&
                    (selectedTdsDetail.metadata.file_url ||
                      selectedTdsDetail.metadata.tds_file_url) && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-emerald-500" />
                          Document
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                              <ExternalLink className="w-4 h-4" />
                              File
                            </div>
                            <a
                              href={
                                selectedTdsDetail.metadata.file_url ||
                                selectedTdsDetail.metadata.tds_file_url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-medium flex items-center gap-2"
                            >
                              {selectedTdsDetail.metadata.file_name ||
                                selectedTdsDetail.metadata.tds_file_name ||
                                "View TDS file"}
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          {selectedTdsDetail.metadata.file_type && (
                            <div>
                              <div className="text-sm text-slate-500 mb-1">File Type</div>
                              <p className="text-slate-900 font-medium">
                                {selectedTdsDetail.metadata.file_type}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* AI Extracted Data */}
                {selectedTdsDetail.metadata &&
                  typeof selectedTdsDetail.metadata === "object" &&
                  (selectedTdsDetail.metadata.generic_product_name ||
                    selectedTdsDetail.metadata.trade_name ||
                    selectedTdsDetail.metadata.supplier_name ||
                    selectedTdsDetail.metadata.technical_specification) && (
                    <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                        AI Extracted Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTdsDetail.metadata.generic_product_name && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">Generic Product Name</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.generic_product_name}
                            </p>
                          </div>
                        )}
                        {(selectedTdsDetail.metadata.trade_name ||
                          selectedTdsDetail.metadata.Trade_Name) && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">Trade Name</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.trade_name ||
                                selectedTdsDetail.metadata.Trade_Name}
                            </p>
                          </div>
                        )}
                        {(selectedTdsDetail.metadata.supplier_name ||
                          selectedTdsDetail.metadata.Supplier_Name) && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">Supplier Name</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.supplier_name ||
                                selectedTdsDetail.metadata.Supplier_Name}
                            </p>
                          </div>
                        )}
                        {(selectedTdsDetail.metadata.packaging_size_type ||
                          selectedTdsDetail.metadata["Packaging Size & Type"]) && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">Packaging Size & Type</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.packaging_size_type ||
                                selectedTdsDetail.metadata["Packaging Size & Type"]}
                            </p>
                          </div>
                        )}
                        {(selectedTdsDetail.metadata.net_weight ||
                          selectedTdsDetail.metadata.Net_Weight) && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">Net Weight</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.net_weight ||
                                selectedTdsDetail.metadata.Net_Weight}
                            </p>
                          </div>
                        )}
                        {(selectedTdsDetail.metadata.hs_code ||
                          selectedTdsDetail.metadata.HS_Code) && (
                          <div>
                            <div className="text-sm text-slate-600 mb-1">HS Code</div>
                            <p className="text-slate-900 font-medium">
                              {selectedTdsDetail.metadata.hs_code ||
                                selectedTdsDetail.metadata.HS_Code}
                            </p>
                          </div>
                        )}
                      </div>
                      {(selectedTdsDetail.metadata.technical_specification ||
                        selectedTdsDetail.metadata.Technical_Specification) && (
                        <div className="mt-4">
                          <div className="text-sm text-slate-600 mb-2">Technical Specification</div>
                          <p className="text-slate-900 whitespace-pre-wrap">
                            {selectedTdsDetail.metadata.technical_specification ||
                              selectedTdsDetail.metadata.Technical_Specification}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* Specs */}
                {selectedTdsDetail.specs &&
                  typeof selectedTdsDetail.specs === "object" &&
                  Object.keys(selectedTdsDetail.specs).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Specifications</h3>
                      <div className="bg-slate-50 rounded-lg p-4">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(selectedTdsDetail.specs, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                {/* Full Metadata */}
                {selectedTdsDetail.metadata &&
                  typeof selectedTdsDetail.metadata === "object" &&
                  Object.keys(selectedTdsDetail.metadata).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-4">Full Metadata</h3>
                      <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap">
                          {JSON.stringify(selectedTdsDetail.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-slate-600">Failed to load TDS details</p>
                <button
                  onClick={closeDetailView}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
