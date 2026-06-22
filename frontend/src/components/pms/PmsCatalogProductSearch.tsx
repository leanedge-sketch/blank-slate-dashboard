import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import {
  fetchChemicalFullData,
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

type PmsCatalogProductSearchProps = {
  value: string | null;
  onSelect: (chemical: ChemicalFullData) => void;
  onClear?: () => void;
  placeholder?: string;
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

export function PmsCatalogProductSearch({
  value,
  onSelect,
  onClear,
  placeholder = "Search vendor, chemical name, or generic name…",
  disabled = false,
}: PmsCatalogProductSearchProps) {
  const { chemicals: catalogChemicals, refreshCatalog } = useProductCatalog();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [remoteResults, setRemoteResults] = useState<ChemicalFullData[]>([]);
  const [searching, setSearching] = useState(false);

  const selected = useMemo(
    () => (value ? findCatalogProduct(value, catalogChemicals) : undefined),
    [value, catalogChemicals],
  );

  useEffect(() => {
    if (selected) {
      setQuery(chemicalSearchPrimaryLabel(selected));
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const loadRemote = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setRemoteResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await fetchChemicalFullData({ search: q, limit: 20 });
      setRemoteResults(res.chemicals);
    } catch {
      setRemoteResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (selected) return;
    const timer = window.setTimeout(() => {
      void loadRemote(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, selected, loadRemote]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const local = q
      ? catalogChemicals.filter((c) => chemicalCatalogSearchText(c).includes(q))
      : catalogChemicals.slice(0, 30);
    return dedupeChemicals([...local, ...remoteResults]).slice(0, 25);
  }, [catalogChemicals, query, remoteResults]);

  function pick(chemical: ChemicalFullData) {
    onSelect(chemical);
    setQuery(chemicalSearchPrimaryLabel(chemical));
    setOpen(false);
    setRemoteResults([]);
  }

  function clearSelection() {
    setQuery("");
    setRemoteResults([]);
    onClear?.();
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <div
          className={`flex flex-1 items-center gap-2 rounded-lg border bg-slate-900 px-3 py-2.5 ${
            open ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-white/10"
          } ${disabled ? "opacity-50" : ""}`}
        >
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-0"
          />
          {searching ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
          ) : null}
          {(value || query) && !disabled ? (
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-300"
              aria-label="Clear product"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-slate-900 shadow-xl">
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">
              {query.trim().length < 2
                ? "Type vendor, chemical name, or generic name…"
                : searching
                  ? "Searching PMS catalog…"
                  : "No matching products in PMS master data."}
            </p>
          ) : (
            <ul className="py-1">
              {suggestions.map((chemical) => {
                const id = catalogProductValue(chemical);
                const isSelected = value === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-cyan-500/10 focus:bg-cyan-500/10 focus:outline-none ${
                        isSelected ? "bg-cyan-500/15" : ""
                      }`}
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
              })}
            </ul>
          )}
        </div>
      )}

      {value && selected?.vendor ? (
        <p className="mt-1 text-[10px] text-slate-500">
          Linked to PMS · {selected.vendor}
          {selected.generic_name && selected.generic_name !== selected.product_name
            ? ` · ${selected.generic_name}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
