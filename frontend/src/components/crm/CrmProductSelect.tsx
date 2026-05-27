import { useMemo } from "react";
import { useProductCatalog } from "../../contexts/ProductCatalogContext";
import { catalogToProductOptions } from "../../utils/catalogProducts";

type CrmProductSelectProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
};

/**
 * Product dropdown backed by the shared PMS catalog (auto-refreshes when PMS adds products).
 */
export function CrmProductSelect({
  value,
  onChange,
  required,
  className = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-500/70",
  placeholder = "Select product",
  id,
}: CrmProductSelectProps) {
  const { chemicals, loading, total } = useProductCatalog();

  const options = useMemo(
    () => catalogToProductOptions(chemicals),
    [chemicals],
  );

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={className}
      >
        <option value="">{placeholder}</option>
        {loading ? (
          <option disabled>Loading products…</option>
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        )}
      </select>
      {!loading && (
        <p className="text-[11px] text-slate-500">
          {options.length} of {total} catalog product
          {total === 1 ? "" : "s"} (synced from PMS)
        </p>
      )}
    </div>
  );
}
