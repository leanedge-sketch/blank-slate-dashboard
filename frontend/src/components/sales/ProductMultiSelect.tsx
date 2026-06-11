import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import type { ChemicalFullData } from "../../services/api";

export interface ProductOption {
  id: string;
  label: string;
  sublabel?: string;
}

function toOption(c: ChemicalFullData): ProductOption | null {
  const id = c.uuid_id ? String(c.uuid_id) : c.id != null ? String(c.id) : null;
  if (!c.product_name || !id) return null;
  const parts: string[] = [];
  if (c.vendor) parts.push(c.vendor);
  if (c.product_category) parts.push(c.product_category);
  return {
    id,
    label: c.product_name,
    sublabel: parts.length ? parts.join(" · ") : undefined,
  };
}

export function ProductMultiSelect({
  products,
  selectedIds,
  onChange,
  placeholder = "Search and add products…",
}: {
  products: ChemicalFullData[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    return products
      .map(toOption)
      .filter((o): o is ProductOption => o !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  const selectedOptions = useMemo(
    () =>
      selectedIds
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is ProductOption => Boolean(o)),
    [selectedIds, options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.filter((o) => !selectedIds.includes(o.id));
    return options.filter(
      (o) =>
        !selectedIds.includes(o.id) &&
        (o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false)),
    );
  }, [options, query, selectedIds]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function addProduct(id: string) {
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
    setQuery("");
    setOpen(true);
  }

  function removeProduct(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div ref={rootRef} className="relative">
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 min-h-[2rem] p-2 rounded-lg border border-slate-200 bg-slate-50">
          {selectedOptions.map((opt) => (
            <span
              key={opt.id}
              className="inline-flex items-center gap-1 max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm text-emerald-900"
            >
              <span className="truncate font-medium">{opt.label}</span>
              <button
                type="button"
                onClick={() => removeProduct(opt.id)}
                className="shrink-0 rounded-full p-0.5 hover:bg-emerald-200/80 text-emerald-800"
                aria-label={`Remove ${opt.label}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 ${
          open ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-300"
        }`}
      >
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 min-w-0 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-slate-400 hover:text-slate-600"
          aria-label="Toggle product list"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">
              {options.length === 0
                ? "No products with UUID available."
                : query.trim()
                  ? "No matching products."
                  : "All products selected."}
            </p>
          ) : (
            <ul className="py-1">
              {filtered.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                    onClick={() => addProduct(opt.id)}
                  >
                    <span className="font-medium text-slate-900">{opt.label}</span>
                    {opt.sublabel ? (
                      <span className="block text-xs text-slate-500 mt-0.5">{opt.sublabel}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-emerald-700 mt-1.5">
          {selectedIds.length} product{selectedIds.length === 1 ? "" : "s"} selected — one
          pipeline deal per product with its own details below.
        </p>
      )}
    </div>
  );
}
