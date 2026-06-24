import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  FlaskConical,
  Package,
  TrendingUp,
  Users,
} from "lucide-react";

const connections = [
  {
    href: "/pms/chemicals",
    icon: FlaskConical,
    title: "PMS Catalog",
    description: "Chemical master data, TDS, and vendor products linked to costing lines.",
    accent: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200",
  },
  {
    href: "/pms/pricing-costing",
    icon: TrendingUp,
    title: "Pricing & Costing",
    description: "Landed costs sync here on save; pull supplier pricing into the calculator.",
    accent: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  {
    href: "/crm/customers",
    icon: Users,
    title: "CRM Customers",
    description: "Pick buyers in Trade Parameters; shipments and pricing match by customer.",
    accent: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  },
  {
    href: "/stock/general-availability",
    icon: Package,
    title: "Stock",
    description: "Check Addis, SEZ, and Nairobi availability for each catalog product line.",
    accent: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  {
    href: "/reports/crm",
    icon: BarChart3,
    title: "Reports & Analysis",
    description: "Integrated view: pipeline, stock, pricing, and trade transit shipments.",
    accent: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  },
  {
    href: "/sales/pipeline",
    icon: TrendingUp,
    title: "Sales Pipeline",
    description: "Open deals for the same customer + product share catalog and pricing links.",
    accent: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
];

export function TradeTransitConnectedModules() {
  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
            Connected modules
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            PMS · CRM · Stock · Reports
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Trade &amp; Transit shares product IDs, customers, landed costs, and stock context
            with the rest of the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {connections.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`group rounded-xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${item.accent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <item.icon className="h-6 w-6 shrink-0 opacity-90" />
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
              </div>
              <h3 className="mt-3 text-base font-bold text-white">{item.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400 font-light leading-relaxed">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
