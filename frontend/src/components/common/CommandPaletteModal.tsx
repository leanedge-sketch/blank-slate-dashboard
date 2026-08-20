import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useCanView } from "../../hooks/usePermissions";
import { useRecentlyAccessed } from "../../hooks/useRecentlyAccessed";
import type { WorkspaceModuleKey } from "../../lib/workspaceModules";

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  module?: WorkspaceModuleKey | null;
}

const WORKSPACE_ITEMS: PaletteItem[] = [
  { id: "home", title: "Home", subtitle: "Workspace launcher", url: "/", module: null },
  { id: "crm", title: "CRM", subtitle: "Customers and interactions", url: "/crm", module: "crm" },
  { id: "pms", title: "PMS", subtitle: "Products and TDS", url: "/pms", module: "pms" },
  {
    id: "finance",
    title: "Trade & Transit",
    subtitle: "Procurement and landed cost",
    url: "/finance/import",
    module: "finance",
  },
  {
    id: "sales",
    title: "Sales Pipeline",
    subtitle: "Deals and quotes",
    url: "/sales/pipeline",
    module: "sales",
  },
  { id: "stock", title: "Stock", subtitle: "Inventory", url: "/stock", module: "stock" },
  { id: "reports", title: "Reports", subtitle: "Coverage and forecasts", url: "/reports", module: "reports" },
  { id: "rfqs", title: "RFQs", subtitle: "Public-site requests", url: "/rfqs", module: "rfqs" },
  {
    id: "logistics",
    title: "Logistics",
    subtitle: "Purchase order corridor",
    url: "/logistics",
    module: "logistics",
  },
];

const ACTION_ITEMS: PaletteItem[] = [
  {
    id: "new-customer",
    title: "New Customer",
    subtitle: "Create a CRM account",
    url: "/crm/customers/new",
    module: "crm",
  },
  {
    id: "create-deal",
    title: "Create Deal",
    subtitle: "Open sales pipeline",
    url: "/sales/pipeline",
    module: "sales",
  },
  {
    id: "stock-availability",
    title: "Stock Availability",
    subtitle: "General availability board",
    url: "/stock/general-availability",
    module: "stock",
  },
  {
    id: "new-quote",
    title: "Create Quote",
    subtitle: "CRM quotation",
    url: "/crm/quotes/new",
    module: "crm",
  },
];

export function CommandPaletteModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { items: recents } = useRecentlyAccessed();
  const canCrm = useCanView("crm");
  const canPms = useCanView("pms");
  const canSales = useCanView("sales");
  const canStock = useCanView("stock");
  const canReports = useCanView("reports");
  const canFinance = useCanView("finance");
  const canRfqs = useCanView("rfqs");
  const canLogistics = useCanView("logistics");

  const allowed = (module?: WorkspaceModuleKey | null) => {
    if (!module) return true;
    if (module === "crm") return canCrm;
    if (module === "pms") return canPms;
    if (module === "sales") return canSales;
    if (module === "stock") return canStock;
    if (module === "reports") return canReports;
    if (module === "finance") return canFinance;
    if (module === "rfqs") return canRfqs;
    if (module === "logistics") return canLogistics;
    return true;
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const recentItems: PaletteItem[] = recents.map((item) => ({
      id: `recent-${item.id}`,
      title: item.title,
      subtitle: `Recent · ${item.subtitle || item.module}`,
      url: item.url,
    }));
    const pool = [...recentItems, ...ACTION_ITEMS, ...WORKSPACE_ITEMS].filter((item) =>
      allowed(item.module),
    );
    const filtered = q
      ? pool.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q),
        )
      : pool;
    const seen = new Set<string>();
    return filtered.filter((item) => {
      if (seen.has(item.url + item.title)) return false;
      seen.add(item.url + item.title);
      return true;
    });
  }, [query, recents, canCrm, canPms, canSales, canStock, canReports, canFinance, canRfqs, canLogistics]);

  useEffect(() => {
    setActive(0);
  }, [results.length, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (location.pathname.startsWith("/login") || location.pathname.startsWith("/auth/")) {
        return;
      }
      const chord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (chord) {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        return;
      }
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const item = results[active];
        if (item) {
          setOpen(false);
          navigate(item.url);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, navigate, location.pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 pt-[12vh] px-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close command palette"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces, actions, recent records…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">No matches</li>
          )}
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  setOpen(false);
                  navigate(item.url);
                }}
                className={`flex w-full flex-col items-start px-4 py-2.5 text-left ${
                  index === active ? "bg-cyan-500/15" : ""
                }`}
              >
                <span className="text-sm font-semibold text-white">{item.title}</span>
                <span className="text-xs text-slate-400">{item.subtitle}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
