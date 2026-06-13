type CurrencyBadgeProps = {
  currency: string;
  variant: "cost" | "price";
};

export function CurrencyBadge({ currency, variant }: CurrencyBadgeProps) {
  const base =
    variant === "cost"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${base}`}
    >
      {currency || "—"}
    </span>
  );
}
