import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchChemicalFullData,
  createChemicalFullData,
  updateChemicalFullData,
  deleteChemicalFullData,
  ChemicalFullData,
  ChemicalFullDataCreate,
  ChemicalFullDataUpdate,
  fetchPartners,
  createPartner,
  fetchProductCategoriesFullData,
  fetchSubCategoriesFullData,
  fetchProductNames,
  fetchMasterDataProductSuggestions,
  type MasterDataProductSuggestion,
} from "../../services/api";
import { ChemicalDetailCard } from "../../components/pms/ChemicalDetailCard";
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
  Sparkles,
} from "lucide-react";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import {
  CHEMICAL_MASTER_COLUMNS,
  chemicalCellValue,
  chemicalMasterCellClass,
  chemicalMasterHeaderClass,
  isChemicalColumnEditable,
  PMS_INDUSTRY_OPTIONS,
  PMS_SECTOR_OPTIONS,
  sortChemicalsBySupplier,
  type ChemicalMasterColumn,
  type ChemicalMasterColumnKey,
} from "../../utils/chemicalMasterColumns";

function dedupeChemicalsById(rows: ChemicalFullData[]): ChemicalFullData[] {
  const seen = new Set<number>();
  const out: ChemicalFullData[] = [];
  for (const row of rows) {
    const id = row.id;
    if (id == null) {
      out.push(row);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

export function ChemicalsPage() {
  const { refreshCatalog } = useProductCatalog();
  const [chemicals, setChemicals] = useState<ChemicalFullData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters & search
  const [search, setSearch] = useState("");
  const [selectedChemical, setSelectedChemical] = useState<ChemicalFullData | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<ChemicalFullData[]>([]);
  const [loadingSearchSuggestions, setLoadingSearchSuggestions] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [createNameSuggestions, setCreateNameSuggestions] = useState<string[]>([]);
  const [showCreateNameSuggestions, setShowCreateNameSuggestions] = useState(false);
  const [masterCreateSuggestions, setMasterCreateSuggestions] = useState<
    MasterDataProductSuggestion[]
  >([]);
  const [loadingCreateSuggestions, setLoadingCreateSuggestions] = useState(false);
  const [filterSector, setFilterSector] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterVendor, setFilterVendor] = useState("");
  const [filterProductCategory, setFilterProductCategory] = useState("");
  const [filterSubCategory, setFilterSubCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Options for dropdowns
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
    generic_name: "",
    product_type: "",
    country_of_origin: "",
  });

  // Inline cell edit (click a column to edit only that field)
  const [editingCell, setEditingCell] = useState<{
    id: number;
    key: ChemicalMasterColumnKey;
  } | null>(null);
  const [cellEditValue, setCellEditValue] = useState("");
  const [updating, setUpdating] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const creatingRef = useRef(false);

  type AddOptionType = "vendor" | "product_category" | "sub_category";

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

    if (addOptionType === "product_category") {
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
      try {
        const newPartner = await createPartner({ partner: value });
        setVendors((prev) => {
          if (prev.some((v) => v.id === newPartner.id)) return prev;
          return [...prev, { id: newPartner.id, vendor: newPartner.partner || value }].sort(
            (a, b) => a.vendor.localeCompare(b.vendor)
          );
        });
        setFormData((prev) => ({
          ...prev,
          vendor: newPartner.partner || value,
          partner_id: newPartner.id,
        }));
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as Error)?.message ||
          "Failed to create partner";
        alert(String(message));
        return;
      }
    }

    closeAddOption();
  }

  async function loadOptions() {
    try {
      // Load each option separately to handle individual failures
      const options = {
        vendors: [] as Array<{ id: string; vendor: string }>,
        categories: [] as string[],
        subCategories: [] as string[],
      };

      try {
        const partnersRes = await fetchPartners({ limit: 1000 });
        options.vendors = (partnersRes?.partners || []).map((p) => ({
          id: p.id,
          vendor: p.partner || "",
        }));
        console.log("Loaded partners (vendors):", options.vendors.length);
      } catch (err: unknown) {
        console.error("Failed to load partners:", err);
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

      setVendors(options.vendors);
      setProductCategories(options.categories);
      setSubCategories(options.subCategories);

      console.log("All options loaded:", {
        sectors: PMS_SECTOR_OPTIONS.length,
        vendors: options.vendors.length,
        categories: options.categories.length,
        subCategories: options.subCategories.length,
      });
    } catch (err) {
      console.error("Failed to load options:", err);
      // Don't set error state - let individual dropdowns show "No X available"
    }
  }

  async function loadChemicals(overrides?: { offset?: number; search?: string }) {
    try {
      setLoading(true);
      setError(null);
      const effectiveOffset = overrides?.offset ?? offset;
      const effectiveSearch =
        overrides?.search !== undefined ? overrides.search : search;
      const params: Record<string, string | number> = {
        limit: effectiveSearch.trim() ? 200 : limit,
        offset: effectiveOffset,
      };
      if (filterSector) params.sector = filterSector;
      if (filterIndustry) params.industry = filterIndustry;
      if (filterVendor) params.vendor = filterVendor;
      if (filterProductCategory) params.product_category = filterProductCategory;
      if (effectiveSearch.trim()) params.search = effectiveSearch.trim();

      const res = await fetchChemicalFullData(params);
      setChemicals(sortChemicalsBySupplier(dedupeChemicalsById(res.chemicals)));
      setTotal(res.total);
    } catch (err: unknown) {
      console.error(err);
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as Error)?.message ||
        "Failed to load chemicals";
      const hint =
        String(detail).includes("Industry") || String(detail).includes("SUPABASE_SERVICE")
          ? " Run docs/0005_chemical_master_data_extend.sql and docs/0005b_chemical_master_data_grants.sql in Supabase if this persists."
          : "";
      setError(String(detail) + hint);
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
      fetchProductNames()
        .then(setProductNames)
        .catch(() => setProductNames([]));
    }
  }, [showCreateForm]);

  const loadSearchSuggestions = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    try {
      setLoadingSearchSuggestions(true);
      const res = await fetchChemicalFullData({ search: q, limit: 10 });
      setSearchSuggestions(sortChemicalsBySupplier(dedupeChemicalsById(res.chemicals)));
    } catch {
      setSearchSuggestions([]);
    } finally {
      setLoadingSearchSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (selectedChemical) return;
    const timer = window.setTimeout(() => {
      void loadSearchSuggestions(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, selectedChemical, loadSearchSuggestions]);

  useEffect(() => {
    if (!showCreateForm) return;
    const term = formData.product_name?.trim() || "";
    if (term.length < 2) {
      setCreateNameSuggestions([]);
      setMasterCreateSuggestions([]);
      return;
    }
    const lower = term.toLowerCase();
    setCreateNameSuggestions(
      productNames.filter((n) => n.toLowerCase().includes(lower)).slice(0, 8),
    );
    const timer = window.setTimeout(async () => {
      try {
        setLoadingCreateSuggestions(true);
        const res = await fetchMasterDataProductSuggestions(term, 6);
        setMasterCreateSuggestions(res);
      } catch {
        setMasterCreateSuggestions([]);
      } finally {
        setLoadingCreateSuggestions(false);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [showCreateForm, formData.product_name, productNames]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    loadChemicals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, filterSector, filterIndustry, filterVendor, filterProductCategory]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    setShowSearchDropdown(false);
    if (searchSuggestions.length === 1) {
      selectChemical(searchSuggestions[0]);
      return;
    }
    const exact = searchSuggestions.find(
      (c) => c.product_name?.toLowerCase() === search.trim().toLowerCase(),
    );
    if (exact) {
      selectChemical(exact);
      return;
    }
    await loadChemicals({ offset: 0, search });
  }

  function selectChemical(chemical: ChemicalFullData) {
    setSelectedChemical(chemical);
    setSearch(chemical.product_name || "");
    setShowSearchDropdown(false);
    setSearchSuggestions([]);
    cancelCellEdit();
  }

  function clearSelectedChemical() {
    setSelectedChemical(null);
    setSearch("");
    cancelCellEdit();
    void loadChemicals({ offset: 0, search: "" });
  }

  function clearFilters() {
    setFilterSector("");
    setFilterIndustry("");
    setFilterVendor("");
    setFilterProductCategory("");
    setSearch("");
    setSelectedChemical(null);
    setOffset(0);
    void loadChemicals({ offset: 0, search: "" });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creatingRef.current) return;
    if (!formData.product_name?.trim()) {
      alert("Product name is required");
      return;
    }

    creatingRef.current = true;
    try {
      setCreating(true);
      // Row_No is assigned by the backend (_next_row_no) — do not guess from the current page.
      const createData: ChemicalFullDataCreate = {
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
      const created = await createChemicalFullData(createData);
      await refreshCatalog();
      setShowCreateForm(false);
      setShowCreateNameSuggestions(false);
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
      selectChemical(created);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create chemical");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function startCellEdit(chemical: ChemicalFullData, key: ChemicalMasterColumnKey) {
    if (!isChemicalColumnEditable(key)) return;
    setEditingCell({ id: chemical.id, key });
    const raw = chemical[key as keyof ChemicalFullData];
    setCellEditValue(raw != null && raw !== "" ? String(raw) : "");
  }

  function cancelCellEdit() {
    setEditingCell(null);
    setCellEditValue("");
  }

  function buildCellPatch(key: ChemicalMasterColumnKey): ChemicalFullDataUpdate {
    const patch: ChemicalFullDataUpdate = {};
    if (key === "price") {
      patch.price = cellEditValue.trim() ? parseFloat(cellEditValue) : null;
      return patch;
    }
    const textKeys: Array<keyof ChemicalFullDataUpdate> = [
      "vendor",
      "sector",
      "industry",
      "product_category",
      "product_name",
      "generic_name",
      "product_type",
      "packing",
      "hs_code",
      "country_of_origin",
      "typical_application",
      "product_description",
    ];
    if (textKeys.includes(key as keyof ChemicalFullDataUpdate)) {
      (patch as Record<string, unknown>)[key] = cellEditValue.trim() || null;
    }
    return patch;
  }

  async function saveCellEdit(chemical: ChemicalFullData) {
    if (!editingCell || editingCell.id !== chemical.id) return;
    if (editingCell.key === "product_name" && !cellEditValue.trim()) {
      alert("Product name is required");
      return;
    }
    await handleUpdate(chemical.id, buildCellPatch(editingCell.key));
    cancelCellEdit();
  }

  async function handleUpdate(id: number, patch: ChemicalFullDataUpdate) {
    try {
      setUpdating(true);
      const updated = await updateChemicalFullData(id, patch);
      await refreshCatalog();
      setChemicals((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updated } : c)),
      );
      if (selectedChemical?.id === id) {
        setSelectedChemical((prev) => (prev ? { ...prev, ...updated } : null));
      }
      await loadChemicals({ search });
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to update chemical");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this chemical? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(id);
      await deleteChemicalFullData(id);
      await refreshCatalog();
      if (selectedChemical?.id === id) {
        setSelectedChemical(null);
      }
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

  /** Sequential # within each supplier group (1, 2, 3… per supplier). */
  const supplierLineNumbers = useMemo(() => {
    let lineNo = 0;
    let prevVendor = "";
    return chemicals.map((chemical) => {
      const vendor = chemical.vendor || "";
      if (vendor !== prevVendor) {
        lineNo = 0;
        prevVendor = vendor;
      }
      lineNo += 1;
      return lineNo;
    });
  }, [chemicals]);

  const inputClass =
    "w-full min-w-[120px] rounded border border-blue-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  function renderMasterDataCell(
    chemical: ChemicalFullData,
    col: ChemicalMasterColumn,
    lineNo: number,
  ) {
    const isEditing =
      editingCell?.id === chemical.id && editingCell.key === col.key;
    const editable = isChemicalColumnEditable(col.key);
    const display = chemicalCellValue(chemical, col.key, lineNo);

    if (isEditing) {
      const saveCancel = (
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            disabled={updating}
            onClick={() => void saveCellEdit(chemical)}
            className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelCellEdit}
            className="rounded border border-slate-300 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      );

      if (col.key === "sector") {
        return (
          <div className="min-w-[140px]">
            <select
              autoFocus
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {PMS_SECTOR_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {saveCancel}
          </div>
        );
      }
      if (col.key === "industry") {
        return (
          <div className="min-w-[140px]">
            <select
              autoFocus
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {PMS_INDUSTRY_OPTIONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            {saveCancel}
          </div>
        );
      }
      if (col.key === "vendor") {
        return (
          <div className="min-w-[140px]">
            <select
              autoFocus
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.vendor}>
                  {v.vendor}
                </option>
              ))}
            </select>
            {saveCancel}
          </div>
        );
      }
      if (col.key === "product_category") {
        return (
          <div className="min-w-[140px]">
            <select
              autoFocus
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {productCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {saveCancel}
          </div>
        );
      }
      if (col.key === "price") {
        return (
          <div className="min-w-[100px]">
            <input
              autoFocus
              type="number"
              step="0.01"
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveCellEdit(chemical);
                if (e.key === "Escape") cancelCellEdit();
              }}
              className={inputClass}
            />
            {saveCancel}
          </div>
        );
      }
      if (col.key === "typical_application" || col.key === "product_description") {
        return (
          <div className="min-w-[200px] max-w-xs">
            <textarea
              autoFocus
              rows={2}
              value={cellEditValue}
              onChange={(e) => setCellEditValue(e.target.value)}
              className={inputClass}
            />
            {saveCancel}
          </div>
        );
      }

      return (
        <div className="min-w-[120px]">
          <input
            autoFocus
            type="text"
            value={cellEditValue}
            onChange={(e) => setCellEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveCellEdit(chemical);
              if (e.key === "Escape") cancelCellEdit();
            }}
            className={inputClass}
          />
          {saveCancel}
        </div>
      );
    }

    if (!editable) {
      return (
        <span
          className={col.key === "current_price" || col.key === "current_cost" ? "text-slate-500" : ""}
          title={
            col.key === "current_price" || col.key === "current_cost"
              ? "Synced from Pricing & Costing"
              : display
          }
        >
          {display}
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          startCellEdit(chemical, col.key);
        }}
        className="group/cell flex w-full items-center gap-1 text-left hover:text-blue-700"
        title={`Click to edit ${col.label}`}
      >
        <span className="truncate">{display}</span>
        <Edit2 className="h-3 w-3 shrink-0 opacity-0 group-hover/cell:opacity-60" />
      </button>
    );
  }

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
                Master product catalog from Chemical_Master_Data. Add and browse products with
                full details — sector, supplier, category, packaging, pricing, and more.
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
                  {PMS_SECTOR_OPTIONS.map((s) => (
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
                  {PMS_INDUSTRY_OPTIONS.map((i) => (
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
                    Sector
                  </label>
                  <select
                    value={formData.sector || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, sector: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Sector...</option>
                    {PMS_SECTOR_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Industry
                  </label>
                  <select
                    value={formData.industry || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, industry: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Industry...</option>
                    {PMS_INDUSTRY_OPTIONS.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
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
                <div className="relative md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.product_name || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, product_name: e.target.value });
                      setShowCreateNameSuggestions(true);
                    }}
                    onFocus={() => setShowCreateNameSuggestions(true)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {showCreateNameSuggestions &&
                  (createNameSuggestions.length > 0 || masterCreateSuggestions.length > 0) ? (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {loadingCreateSuggestions ? (
                        <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Finding similar products…
                        </p>
                      ) : null}
                      {createNameSuggestions.length > 0 ? (
                        <div className="border-b border-slate-100 px-2 py-1.5">
                          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Existing names
                          </p>
                          {createNameSuggestions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, product_name: name });
                                setShowCreateNameSuggestions(false);
                              }}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-blue-50"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {masterCreateSuggestions.length > 0 ? (
                        <div className="px-2 py-1.5">
                          <p className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            <Sparkles className="h-3 w-3" />
                            Already in master data
                          </p>
                          {masterCreateSuggestions.map((s, i) => (
                            <div
                              key={`${s.master_row_no}-${i}`}
                              className="rounded-lg px-3 py-2 text-sm text-slate-600"
                            >
                              <span className="font-medium text-slate-900">
                                {s.match_label || s.product_name}
                              </span>
                              {s.vendor ? (
                                <span className="ml-2 text-xs text-slate-500">{s.vendor}</span>
                              ) : null}
                              {s.master_row_no != null ? (
                                <span className="ml-2 text-xs text-amber-700">
                                  Ref #{s.master_row_no}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Generic Name
                  </label>
                  <input
                    type="text"
                    value={formData.generic_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, generic_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={formData.product_type || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, product_type: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Country of Origin
                  </label>
                  <input
                    type="text"
                    value={formData.country_of_origin || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, country_of_origin: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="flex-1 relative" ref={searchBoxRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSearchDropdown(true);
                  if (selectedChemical) setSelectedChemical(null);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                autoComplete="off"
                placeholder="Search product, supplier, category, HS code…"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {showSearchDropdown && search.trim().length >= 2 ? (
                <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {loadingSearchSuggestions ? (
                    <p className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      Searching…
                    </p>
                  ) : searchSuggestions.length > 0 ? (
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {searchSuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => selectChemical(c)}
                            className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-blue-50 transition-colors"
                          >
                            <span className="font-medium text-slate-900">
                              {c.product_name || "Unnamed"}
                            </span>
                            <span className="text-xs text-slate-500">
                              {[c.vendor, c.product_category, c.sector]
                                .filter(Boolean)
                                .join(" · ")}
                              {c.id != null ? ` · Ref #${c.id}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-3 text-sm text-slate-500">No matching chemicals.</p>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold hover:shadow-lg transition-all"
            >
              Search
            </button>
            {(search || selectedChemical) && (
              <button
                type="button"
                onClick={() => clearSelectedChemical()}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadChemicals()}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results */}
        {selectedChemical ? (
          <ChemicalDetailCard
            chemical={selectedChemical}
            updating={updating}
            deleting={deletingId === selectedChemical.id}
            editingCell={editingCell}
            onStartEdit={(key) => startCellEdit(selectedChemical, key)}
            renderEditor={(col) => renderMasterDataCell(selectedChemical, col, 1)}
            onDelete={() => void handleDelete(selectedChemical.id)}
            onBack={clearSelectedChemical}
          />
        ) : loading && chemicals.length === 0 ? (
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600 tabular-nums">
                Showing{" "}
                <span className="font-semibold">
                  {total === 0 ? 0 : offset + 1}–{offset + chemicals.length}
                </span>{" "}
                of <span className="font-semibold">{total}</span> chemicals
                {totalPages > 1 && (
                  <span className="text-slate-500">
                    {" "}
                    · page {currentPage} of {totalPages}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                # resets within each supplier · Ref = master row number
              </p>
            </div>

            {/* Chemical List - Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                Click any editable cell to update that field only. Scroll horizontally for all
                columns — current price/cost sync from Pricing &amp; Costing.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1600px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {CHEMICAL_MASTER_COLUMNS.map((col) => (
                        <th key={col.key} className={chemicalMasterHeaderClass(col)}>
                          {col.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider sticky right-0 bg-slate-50">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
              {chemicals.map((chemical, index) => {
                const prevVendor =
                  index > 0 ? chemicals[index - 1].vendor || "" : null;
                const currentVendor = chemical.vendor || "";
                const showSupplierHeader =
                  index === 0 || currentVendor !== (prevVendor || "");
                const lineNo = supplierLineNumbers[index] ?? index + 1;

                return (
                      <Fragment key={`${chemical.id ?? "row"}-${index}`}>
                        {showSupplierHeader && (
                          <tr className="bg-slate-100 border-y border-slate-200">
                            <td
                              colSpan={CHEMICAL_MASTER_COLUMNS.length + 1}
                              className="px-4 py-2 text-sm font-semibold text-slate-800"
                            >
                              <span className="inline-flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-600" />
                                {currentVendor || "Unassigned supplier"}
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr
                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                          onClick={() => selectChemical(chemical)}
                >
                            {CHEMICAL_MASTER_COLUMNS.map((col) => (
                              <td
                                key={col.key}
                                className={`${chemicalMasterCellClass(col)} ${
                                  isChemicalColumnEditable(col.key) &&
                                  editingCell?.id !== chemical.id
                                    ? "cursor-pointer"
                                    : ""
                                } ${
                                  editingCell?.id === chemical.id &&
                                  editingCell.key === col.key
                                    ? "bg-blue-50/80 ring-1 ring-inset ring-blue-200"
                                    : ""
                                }`}
                              >
                                {renderMasterDataCell(chemical, col, lineNo)}
                              </td>
                            ))}
                            <td className="px-4 py-3 whitespace-nowrap text-sm sticky right-0 bg-white border-l border-slate-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-2">
                          {chemical.uuid_id ? (
                            <Link
                              to={`/stock/product-label?catalog_id=${encodeURIComponent(String(chemical.uuid_id))}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Stock ledger"
                            >
                              <Package size={16} />
                            </Link>
                          ) : null}
                          <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectChemical(chemical);
                                  }}
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  title="Open detail view"
                                >
                                  <Eye size={16} />
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
                        </tr>
                      </Fragment>
                );
              })}
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
