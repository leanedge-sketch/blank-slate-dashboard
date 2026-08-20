import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { useRecentlyAccessed } from "../../hooks/useRecentlyAccessed";

export function RecentlyAccessedShelf() {
  const { items } = useRecentlyAccessed();
  if (!items.length) return null;

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-16" aria-label="Recently accessed">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Recently accessed</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => (
            <Link
              key={`${item.module}-${item.id}`}
              to={item.url}
              className="min-w-[220px] max-w-[260px] shrink-0 rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 transition hover:-translate-y-0.5 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {item.subtitle || item.module}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
