import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import {
  fetchChemicalFullData,
  fetchVendors,
  type ChemicalFullData,
} from "../../services/api";
import {
  catalogProductValue,
  chemicalCatalogSearchText,
  findCatalogProduct,
} from "../../utils/catalogProducts";
import {
  chemicalSearchPrimaryLabel,
  chemicalSearchSecondaryLabel,
} from "../../utils/chemicalMasterColumns";

type PmsVendorProductPickerProps = {
  value: string | null;
  onSelect: (chemical: ChemicalFullData) => void;
  onClear?: () => void;
  disabled?: boolean;
};

function dedupeChemicals(rows: ChemicalFullData[]): ChemicalFullData[] {
  const seen = new Set<string>();
  const out: ChemicalFullData[] = [];
  for (const row of rows) {
    const key = catalogProductValue(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function vendorKey(v: string): string {
  return v.trim().toLowerCase();
}

function matchesVendor(chemical: ChemicalFullData, vendor: string): boolean {
  if (!vendor.trim()) return true;
  return vendorKey(chemical.vendor || "") === vendorKey(vendor);
}

export function PmsVendorProductPicker({
  value,
  onSelect,
  onClear,
  disabled = false,
}: PmsVendorProductPickerProps) {
  const { chemicals: catalogChemicals, refreshCatalog } = useProductCatalog();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [vendors, setVendors] = useState<string[]>([]);
  const [vendorFilter, setVendorFilter] = useState("");
  const [vendorProducts, setVendorProducts] = useState<ChemicalFullData[]>([]);
  const [loadingVendorProducts, setLoadingVendorProducts] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [remoteResults, setRemoteResults] = useState<ChemicalFullData[]>([]);
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const selected = useMemo(
    () => (value ? findCatalogProduct(value, catalogChemicals) : undefined),
    [value, catalogChemicals],
  );

  useEffect(() => {
    void refreshCatalog();
    fetchVendors()
      .then((list) => setVendors(list || []))
      .catch(() => {
        const fromCatalog = [
          ...new Set(
            catalogChemicals
              .map((c) => c.vendor?.trim())
              .filter((v): v is string => Boolean(v)),
          ),
        ].sort((a, b) => a.localeCompare(b));
        setVendors(fromCatalog);
      });
  }, [refreshCatalog, catalogChemicals]);

  useEffect(() => {
    if (selected?.vendor && !vendorFilter) {
      setVendorFilter(selected.vendor);
    }
  }, [selected?.vendor, vendorFilter]);

  useEffect(() => {
    if (!isEditing) {
      setQuery(selected ? chemicalSearchPrimaryLabel(selected) : "");
    }
  }, [selected, value, isEditing]);

  const loadVendorProducts = useCallback(async (vendor: string) => {
    const trimmed = vendor.trim();
    if (!trimmed) {
      setVendorProducts([]);
      return;
    }
    try {
      setLoadingVendorProducts(true);
      const res = await fetchChemicalFullData({ vendor: trimmed, limit: 500 });
      setVendorProducts(res.chemicals);
    } catch {
      const local = catalogChemicals.filter((c) => matchesVendor(c, trimmed));
      setVendorProducts(local);
    } finally {
      setLoadingVendorProducts(false);
    }
  }, [catalogChemicals]);

  useEffect(() => {
    if (vendorFilter.trim()) {
      void loadVendorProducts(vendorFilter);
    } else {
      setVendorProducts([]);
    }
  }, [vendorFilter, loadVendorProducts]);

  const loadRemote = useCallback(
    async (term: string) => {
      const q = term.trim();
      if (!q) {
        setRemoteResults([]);
        return;
      }
      try {
        setSearching(true);
        const res = await fetchChemicalFullData({
          search: q,
          vendor: vendorFilter.trim() || undefined,
          limit: 25,
        });
        setRemoteResults(res.chemicals);
      } catch {
        setRemoteResults([]);
      } finally {
        setSearching(false);
      }
    },
    [vendorFilter],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isEditing || !value) {
        void loadRemote(query);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, isEditing, value, loadRemote]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const vendorOptions = useMemo(() => {
    const set = new Set(vendors.map((v) => v.trim()).filter(Boolean));
    if (selected?.vendor?.trim()) set.add(selected.vendor.trim());
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [vendors, selected?.vendor]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();

    let pool: ChemicalFullData[];
    if (vendorFilter.trim()) {
      pool =
        vendorProducts.length > 0
          ? vendorProducts
          : catalogChemicals.filter((c) => matchesVendor(c, vendorFilter));
    } else if (q) {
      pool = dedupeChemicals([
        ...catalogChemicals.filter((c) => chemicalCatalogSearchText(c).includes(q)),
        ...remoteResults,
      ]);
    } else {
      pool = catalogChemicals.slice(0, 40);
    }

    if (q) {
      pool = pool.filter((c) => chemicalCatalogSearchText(c).includes(q));
    }

    return dedupeChemicals(pool).slice(0, 30);
  }, [vendorFilter, vendorProducts, catalogChemicals, query, remoteResults]);

  useLayoutEffect(() => {
    if (!open || !searchAnchorRef.current) {
      setDropdownStyle(null);
      return;
    }

    const updatePosition = () => {
      const rect = searchAnchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, query, suggestions.length, vendorFilter]);

  const selectOptions = useMemo(() => {
    if (!vendorFilter.trim()) return [];
    return dedupeChemicals(
      vendorProducts.length > 0
        ? vendorProducts
        : catalogChemicals.filter((c) => matchesVendor(c, vendorFilter)),
    ).sort((a, b) =>
      (a.product_name || "").localeCompare(b.product_name || "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [vendorFilter, vendorProducts, catalogChemicals]);

  function pick(chemical: ChemicalFullData) {
    if (chemical.vendor) setVendorFilter(chemical.vendor);
    onSelect(chemical);
    setQuery(chemicalSearchPrimaryLabel(chemical));
    setIsEditing(false);
    setOpen(false);
    setRemoteResults([]);
  }

  function clearAll() {
    setQuery("");
    setIsEditing(false);
    setRemoteResults([]);
    onClear?.();
  }

  function handleVendorChange(next: string) {
    setVendorFilter(next);
    setQuery("");
    setIsEditing(true);
    setOpen(true);
    if (value) onClear?.();
  }

  const darkSelect =
    "w-full rounded-lg border border-slate-800 bg-[#0B1120] px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/40";

  return (
    <div ref={rootRef} className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vendor
        </label>
        <div className="relative">
          <select
            value={vendorFilter}
            disabled={disabled}
            onChange={(e) => handleVendorChange(e.target.value)}
            className={`${darkSelect} appearance-none pr-9`}
          >
            <option value="">All vendors — search catalog</option>
            {vendorOptions.map((vendor) => (
              <option key={vendor} value={vendor}>
                {vendor}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      {vendorFilter.trim() && selectOptions.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chemical from {vendorFilter}
          </label>
          <div className="relative">
            <select
              value={value ?? ""}
              disabled={disabled || loadingVendorProducts}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) {
                  clearAll();
                  return;
                }
                const chemical = selectOptions.find(
                  (c) => catalogProductValue(c) === id,
                );
                if (chemical) pick(chemical);
              }}
              className={`${darkSelect} appearance-none pr-9`}
            >
              <option value="">
                {loadingVendorProducts
                  ? "Loading vendor products…"
                  : `Select chemical (${selectOptions.length})…`}
              </option>
              {selectOptions.map((chemical) => (
                <option key={catalogProductValue(chemical)} value={catalogProductValue(chemical)}>
                  {chemicalSearchPrimaryLabel(chemical)}
                  {chemical.generic_name &&
                  chemical.generic_name !== chemical.product_name
                    ? ` — ${chemical.generic_name}`
                    : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      )}

      <div ref={searchAnchorRef}>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          {vendorFilter.trim() ? "Search within vendor" : "Search catalog"}
        </label>
        <div
          className={`flex items-center gap-2 rounded-lg border bg-[#0B1120] px-3 py-2.5 ${
            open ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-slate-800"
          } ${disabled ? "opacity-50" : ""}`}
        >
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsEditing(true);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              vendorFilter.trim()
                ? "Filter by chemical or generic name…"
                : "Vendor, chemical name, or generic name…"
            }
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-0"
          />
          {(searching || loadingVendorProducts) && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
          )}
          {(value || query) && !disabled ? (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-300"
              aria-label="Clear product"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open &&
        !disabled &&
        dropdownStyle &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={dropdownRef}
            role="listbox"
            style={{
              position: "fixed",
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              zIndex: 9999,
            }}
            className="max-h-56 overflow-y-auto rounded-lg border border-slate-600 bg-slate-900 shadow-2xl shadow-black/50 py-1"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-500">
                {loadingVendorProducts
                  ? "Loading vendor catalog…"
                  : vendorFilter.trim()
                    ? "No chemicals match this vendor and search."
                    : query.trim()
                      ? searching
                        ? "Searching…"
                        : "No matching products."
                      : "Type to search or pick a vendor above."}
              </li>
            ) : (
              suggestions.map((chemical) => {
                const id = catalogProductValue(chemical);
                const isSelected = value === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-cyan-500/10 focus:bg-cyan-500/10 focus:outline-none ${
                        isSelected ? "bg-cyan-500/15" : ""
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(chemical)}
                    >
                      <span className="font-medium text-slate-100">
                        {chemicalSearchPrimaryLabel(chemical)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {chemicalSearchSecondaryLabel(chemical)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}

      {value && selected ? (
        <p className="text-[10px] text-slate-500">
          Linked · {selected.vendor || "PMS"}
          {selected.generic_name && selected.generic_name !== selected.product_name
            ? ` · ${selected.generic_name}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
