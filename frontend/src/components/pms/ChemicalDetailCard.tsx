import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Edit2,
  FileText,
  Hash,
  Loader2,
  Package,
  Tag,
  Trash2,
} from "lucide-react";
import type { ChemicalFullData } from "../../services/api";
import {
  CHEMICAL_MASTER_COLUMNS,
  chemicalCellValue,
  isChemicalColumnEditable,
  type ChemicalMasterColumn,
  type ChemicalMasterColumnKey,
} from "../../utils/chemicalMasterColumns";

const DETAIL_SECTIONS: Array<{
  title: string;
  icon: typeof Tag;
  keys: ChemicalMasterColumnKey[];
}> = [
  {
    title: "Product identity",
    icon: Tag,
    keys: ["product_name", "generic_name", "product_type", "product_category"],
  },
  {
    title: "Supplier & classification",
    icon: Building2,
    keys: ["vendor", "sector", "industry", "country_of_origin"],
  },
  {
    title: "Pricing",
    icon: DollarSign,
    keys: ["price", "current_price", "current_cost"],
  },
  {
    title: "Packaging & codes",
    icon: Hash,
    keys: ["packing", "hs_code"],
  },
  {
    title: "Application & description",
    icon: FileText,
    keys: ["typical_application", "product_description"],
  },
];

type ChemicalDetailCardProps = {
  chemical: ChemicalFullData;
  updating: boolean;
  deleting: boolean;
  editingCell: { id: number; key: ChemicalMasterColumnKey } | null;
  onStartEdit: (key: ChemicalMasterColumnKey) => void;
  renderEditor: (col: ChemicalMasterColumn) => ReactNode;
  onDelete: () => void;
  onBack: () => void;
};

export function ChemicalDetailCard({
  chemical,
  updating,
  deleting,
  editingCell,
  onStartEdit,
  renderEditor,
  onDelete,
  onBack,
}: ChemicalDetailCardProps) {
  const colByKey = new Map(CHEMICAL_MASTER_COLUMNS.map((c) => [c.key, c]));

  function renderField(col: ChemicalMasterColumn) {
    const isEditing = editingCell?.id === chemical.id && editingCell.key === col.key;
    const editable = isChemicalColumnEditable(col.key);
    const display = chemicalCellValue(chemical, col.key);

    if (isEditing) {
      return (
        <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          {renderEditor(col)}
        </div>
      );
    }

    return (
      <button
        type="button"
        disabled={!editable}
        onClick={() => editable && onStartEdit(col.key)}
        className={`group mt-1 w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
          editable
            ? "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
            : "cursor-default border-slate-100 bg-slate-50"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span
            className={`text-sm ${
              display === "—" ? "text-slate-400 italic" : "text-slate-900"
            } ${col.key === "typical_application" || col.key === "product_description" ? "whitespace-pre-wrap" : ""}`}
          >
            {display}
          </span>
          {editable ? (
            <Edit2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
          ) : null}
        </div>
        {(col.key === "current_price" || col.key === "current_cost") && (
          <p className="mt-1 text-[10px] text-slate-400">Synced from Pricing &amp; Costing</p>
        )}
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Browse all chemicals
        </button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Ref #{chemical.id}
              {chemical.uuid_id ? ` · ${String(chemical.uuid_id).slice(0, 8)}…` : ""}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              {chemical.product_name || "Unnamed product"}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              {chemical.vendor ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {chemical.vendor}
                </span>
              ) : null}
              {chemical.sector ? <span>· {chemical.sector}</span> : null}
              {chemical.industry ? <span>· {chemical.industry}</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {chemical.uuid_id ? (
              <Link
                to={`/stock/product-label?catalog_id=${encodeURIComponent(String(chemical.uuid_id))}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                <Package className="h-3.5 w-3.5" />
                Stock
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {DETAIL_SECTIONS.map(({ title, icon: Icon, keys }) => (
          <section key={title}>
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Icon className="h-3.5 w-3.5" />
              {title}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {keys.map((key) => {
                const col = colByKey.get(key);
                if (!col) return null;
                return (
                  <div
                    key={key}
                    className={
                      key === "typical_application" || key === "product_description"
                        ? "sm:col-span-2"
                        : ""
                    }
                  >
                    <label className="text-xs font-medium text-slate-500">{col.label}</label>
                    {renderField(col)}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {editingCell?.id === chemical.id ? (
          <p className="text-xs text-slate-500">
            Editing {colByKey.get(editingCell.key)?.label ?? "field"} — save or cancel in the
            field editor above.
          </p>
        ) : (
          <p className="text-xs text-slate-400">
            Click any field to edit. Current price and cost update from Pricing &amp; Costing.
          </p>
        )}
      </div>

      {(updating || deleting) && (
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-2 text-xs text-slate-500">
          {updating ? "Saving changes…" : "Deleting…"}
        </div>
      )}
    </div>
  );
}
