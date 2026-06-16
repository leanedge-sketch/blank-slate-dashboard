import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  fetchTDS,
  createTDS,
  fetchChemicalFullData,
  generateTdsDescription,
  Tds,
  TdsCreate,
  ChemicalFullData,
} from "../../services/api";
import {
  FileText,
  Plus,
  X,
  Loader2,
  ChevronLeft,
  Upload,
  Sparkles,
  Table2,
  Search,
} from "lucide-react";
import { TDS_MASTER_COLUMNS } from "../../utils/tdsMasterColumns";
import { resolveTdsDocumentUrl } from "../../utils/tdsDocument";
import { getTdsProductDescription } from "../../utils/tdsDescription";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import {
  catalogProductValue,
  findCatalogProduct,
} from "../../utils/catalogProducts";
import {
  chemicalSearchPrimaryLabel,
  chemicalSearchSecondaryLabel,
} from "../../utils/chemicalMasterColumns";

type TdsTab = "catalog" | "add";

function resolveProductForTds(
  tds: Tds,
  chemicals: ChemicalFullData[],
): ChemicalFullData | undefined {
  const ref = tds.chemical_type_id || (tds as Tds & { chemical_id?: string }).chemical_id;
  if (ref) {
    const found = findCatalogProduct(ref, chemicals);
    if (found) return found;
  }
  const catalogId = tds.metadata?.chemical_full_data_id;
  if (catalogId != null) {
    return chemicals.find((c) => String(c.id) === String(catalogId));
  }
  return undefined;
}

function matchCatalogProduct(
  query: string,
  chemicals: ChemicalFullData[],
): ChemicalFullData | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return chemicals.find((c) => {
    const fields = [c.product_name, c.generic_name, c.vendor]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return fields.some((f) => f.includes(q) || q.includes(f));
  });
}

export function TDSPage() {
  const { chemicals: catalogChemicals } = useProductCatalog();
  const [activeTab, setActiveTab] = useState<TdsTab>("catalog");

  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<TdsCreate>({
    chemical_type_id: null,
    brand: "",
    grade: "",
    owner: "",
    source: "",
  });

  const [selectedProduct, setSelectedProduct] = useState<ChemicalFullData | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<ChemicalFullData[]>([]);
  const [loadingProductSearch, setLoadingProductSearch] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, unknown> | null>(null);
  const [productDescription, setProductDescription] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [aiDescriptionSnapshot, setAiDescriptionSnapshot] = useState("");

  async function loadTDS() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTDS({ limit: 200 });
      setTdsList(res.tds);
      setTotal(res.total);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load TDS records";
      setError(String(message));
    } finally {
      setLoading(false);
    }
  }

  const loadProductSuggestions = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setProductSuggestions([]);
      return;
    }
    try {
      setLoadingProductSearch(true);
      const res = await fetchChemicalFullData({ search: q, limit: 12 });
      setProductSuggestions(res.chemicals);
    } catch {
      setProductSuggestions([]);
    } finally {
      setLoadingProductSearch(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProduct) return;
    const timer = window.setTimeout(() => {
      void loadProductSuggestions(productSearch);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch, selectedProduct, loadProductSuggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (activeTab === "catalog") {
      void loadTDS();
    }
  }, [activeTab]);

  function selectProduct(chemical: ChemicalFullData) {
    setSelectedProduct(chemical);
    setFormData((prev) => ({
      ...prev,
      chemical_type_id: catalogProductValue(chemical),
    }));
    setProductSearch(chemicalSearchPrimaryLabel(chemical));
    setProductSuggestions([]);
    setShowProductDropdown(false);
  }

  function clearSelectedProduct() {
    setSelectedProduct(null);
    setProductSearch("");
    setProductSuggestions([]);
    setFormData((prev) => ({ ...prev, chemical_type_id: null }));
  }

  function resetAddForm() {
    setFormData({
      chemical_type_id: null,
      brand: "",
      grade: "",
      owner: "",
      source: "",
    });
    clearSelectedProduct();
    setSelectedFile(null);
    setExtractedData(null);
    setProductDescription("");
    setAiDescriptionSnapshot("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is ${maxSize / 1024 / 1024}MB`);
      return;
    }
    setSelectedFile(file);
    setExtractedData(null);
  }

  function productNameForForm(): string {
    if (selectedProduct?.product_name) return selectedProduct.product_name;
    if (selectedProduct?.generic_name) return selectedProduct.generic_name;
    const ref = formData.chemical_type_id;
    if (!ref) return "";
    const match = findCatalogProduct(ref, catalogChemicals);
    return match?.product_name || match?.generic_name || "";
  }

  async function handleGenerateDescription() {
    const productName = productNameForForm();
    if (!formData.brand?.trim() && !productName) {
      alert("Enter a brand or select a product to generate a description.");
      return;
    }
    try {
      setGeneratingDescription(true);
      const result = await generateTdsDescription({
        brand: formData.brand || null,
        grade: formData.grade || null,
        owner: formData.owner || null,
        chemical_type_name: productName || null,
        use_web: true,
      });
      const desc = result.product_description || result.ai_product_description || "";
      setProductDescription(desc);
      setAiDescriptionSnapshot(
        result.ai_product_description || result.product_description || "",
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to generate description";
      alert(String(message));
    } finally {
      setGeneratingDescription(false);
    }
  }

  async function handleAIExtraction() {
    if (!selectedFile) {
      alert("Please select a file first");
      return;
    }
    try {
      setExtracting(true);
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);
      const res = await api.post("/pms/tds/extract-ai", uploadForm, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data as Record<string, unknown>;
      setExtractedData(data);

      const desc = String(data.product_description || data.ai_product_description || "");
      if (desc) {
        setProductDescription(desc);
        setAiDescriptionSnapshot(
          String(data.ai_product_description || data.product_description || ""),
        );
      }

      setFormData((prev) => ({
        ...prev,
        brand: String(data.trade_name || data.brand || prev.brand || ""),
        grade: String(data.grade || prev.grade || ""),
        owner: String(data.supplier_name || data.owner || prev.owner || ""),
        source: String(data.source || prev.source || ""),
      }));

      const genericName = String(data.generic_product_name || "");
      const supplierName = String(data.supplier_name || data.owner || "");
      const searchTerms = [genericName, supplierName].filter(Boolean);
      for (const term of searchTerms) {
        let matched = matchCatalogProduct(term, catalogChemicals);
        if (!matched && term.length >= 2) {
          try {
            const res = await fetchChemicalFullData({ search: term, limit: 5 });
            matched = matchCatalogProduct(term, res.chemicals);
          } catch {
            /* ignore */
          }
        }
        if (matched) {
          selectProduct(matched);
          break;
        }
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "AI extraction failed";
      alert(String(message));
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreating(true);
      const trimmedDescription = productDescription.trim();
      const metadataBase =
        extractedData || selectedFile ? { ...(extractedData || {}) } : {};

      const metadata =
        trimmedDescription || Object.keys(metadataBase).length > 0 || selectedProduct
          ? {
              ...metadataBase,
              file_url: extractedData?.file_url,
              file_name: extractedData?.file_name || selectedFile?.name,
              file_type: extractedData?.file_type || extractedData?.file_content_type,
              temp_file_key: extractedData?.temp_file_key,
              chemical_full_data_id: selectedProduct?.id ?? undefined,
              product_description: trimmedDescription || undefined,
              ai_product_description:
                aiDescriptionSnapshot ||
                extractedData?.ai_product_description ||
                extractedData?.product_description ||
                trimmedDescription ||
                undefined,
              description_source:
                extractedData?.description_source ||
                (aiDescriptionSnapshot ? "ai" : undefined),
              extracted_at: extractedData ? new Date().toISOString() : undefined,
            }
          : undefined;

      await createTDS({
        ...formData,
        chemical_type_id: formData.chemical_type_id || null,
        metadata: metadata as TdsCreate["metadata"],
      });
      resetAddForm();
      setActiveTab("catalog");
      await loadTDS();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to create TDS record";
      alert(String(message));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
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
              Browse the TDS catalog or upload a new Technical Data Sheet with AI extraction.
            </p>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === "catalog"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table2 className="w-4 h-4" />
            TDS Catalog
            {total > 0 && (
              <span className="ml-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                {total}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === "add"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add TDS
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {activeTab === "catalog" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <p className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
              {total === 0
                ? "No TDS records yet — use the Add TDS tab to upload your first document."
                : (
                  <>
                    Showing <strong>{tdsList.length}</strong> of <strong>{total}</strong> TDS
                    records
                  </>
                )}
            </p>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left">
                      {TDS_MASTER_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tdsList.length === 0 ? (
                      <tr>
                        <td
                          colSpan={TDS_MASTER_COLUMNS.length}
                          className="px-4 py-16 text-center text-slate-500"
                        >
                          Empty catalog — add a TDS from the Add TDS tab.
                        </td>
                      </tr>
                    ) : (
                      tdsList.map((tds) => {
                        const product = resolveProductForTds(tds, catalogChemicals);
                        const meta =
                          tds.metadata && typeof tds.metadata === "object"
                            ? (tds.metadata as Record<string, unknown>)
                            : null;
                        const docUrl = resolveTdsDocumentUrl(meta);
                        const description = getTdsProductDescription(meta);
                        return (
                          <tr key={tds.id} className="hover:bg-emerald-50/40">
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {tds.brand || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {product?.product_name || product?.generic_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {product?.vendor || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{tds.grade || "—"}</td>
                            <td className="px-4 py-3 text-slate-700">{tds.owner || "—"}</td>
                            <td className="px-4 py-3 text-slate-700">{tds.source || "—"}</td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                              {description || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {docUrl ? (
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 hover:text-emerald-900 font-medium"
                                >
                                  {(meta?.file_name as string) || "PDF"}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {tds.created_at
                                ? new Date(tds.created_at).toLocaleDateString()
                                : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "add" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Add TDS Record</h2>

            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-900">AI-Powered Extraction</h3>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Upload a TDS file (PDF, DOCX, XLSX, TXT) and let AI extract brand, grade, supplier,
                and description.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex-1 min-w-[200px] cursor-pointer">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".pdf,.docx,.xlsx,.xls,.txt"
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span className="text-sm text-slate-700 truncate">
                      {selectedFile ? selectedFile.name : "Choose TDS file…"}
                    </span>
                  </div>
                </label>
                {selectedFile && (
                  <>
                    <button
                      type="button"
                      onClick={handleAIExtraction}
                      disabled={extracting}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold disabled:opacity-50"
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Extracting…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Extract with AI
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setExtractedData(null);
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="block space-y-1 md:col-span-2" ref={productSearchRef}>
                  <span className="text-sm font-medium text-slate-700">
                    Product (search by name or supplier)
                  </span>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            if (selectedProduct) {
                              setSelectedProduct(null);
                              setFormData((prev) => ({ ...prev, chemical_type_id: null }));
                            }
                            setShowProductDropdown(true);
                          }}
                          onFocus={() => setShowProductDropdown(true)}
                          placeholder="Type product name or vendor/supplier…"
                          className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2"
                        />
                      </div>
                      {(selectedProduct || productSearch) && (
                        <button
                          type="button"
                          onClick={clearSelectedProduct}
                          className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                          title="Clear product"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {selectedProduct && (
                      <p className="mt-1.5 text-xs text-emerald-700">
                        Linked: {chemicalSearchPrimaryLabel(selectedProduct)}
                        {selectedProduct.vendor ? ` · ${selectedProduct.vendor}` : ""}
                      </p>
                    )}
                    {showProductDropdown && !selectedProduct && productSearch.trim().length >= 2 && (
                      <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                        {loadingProductSearch ? (
                          <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                            Searching…
                          </p>
                        ) : productSuggestions.length > 0 ? (
                          <ul className="max-h-72 overflow-y-auto py-1">
                            {productSuggestions.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => selectProduct(c)}
                                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-emerald-50 transition-colors"
                                >
                                  <span className="font-medium text-slate-900">
                                    {chemicalSearchPrimaryLabel(c)}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {chemicalSearchSecondaryLabel(c)}
                                    {c.id != null ? ` · Ref #${c.id}` : ""}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-4 py-3 text-sm text-slate-500">No matching products.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Brand</span>
                  <input
                    type="text"
                    value={formData.brand || ""}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Grade</span>
                  <input
                    type="text"
                    value={formData.grade || ""}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-medium text-slate-700">Owner</span>
                  <input
                    type="text"
                    value={formData.owner || ""}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Source</span>
                  <input
                    type="text"
                    value={formData.source || ""}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2"
                  />
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Product description</p>
                    <p className="text-xs text-slate-500">
                      Auto-filled from upload or AI — edit before saving.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {generatingDescription ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate with AI
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={5}
                  placeholder="What this product is, typical uses, and notable properties…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm resize-y min-h-[120px]"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold disabled:opacity-50"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save TDS"
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetAddForm}
                  className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Clear form
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
