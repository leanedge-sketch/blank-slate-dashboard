import { Link } from "react-router-dom";
import { ArrowRight, Package, Sparkles, Warehouse } from "lucide-react";

const modules = [
  {
    icon: Package,
    title: "Product Label Stock",
    subtitle: "Product Labels · Movements",
    description:
      "Monitor product label stock and detailed stock movements. Track inventory flow and movement history in real time.",
    href: "/stock/product-label",
    cta: "View product labels",
    accent: "from-indigo-600 via-indigo-500 to-purple-500",
    accentHover: "group-hover:shadow-indigo-500/40",
  },
  {
    icon: Warehouse,
    title: "General Stock Availability",
    subtitle: "Warehouses · Overview",
    description:
      "Comprehensive stock availability across Addis Ababa, SEZ Kenya, and Nairobi Partner locations.",
    href: "/stock/general-availability",
    cta: "View availability",
    accent: "from-amber-600 via-orange-500 to-yellow-500",
    accentHover: "group-hover:shadow-amber-500/40",
  },
];

export function StockHomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      <div className="relative z-10">
        <div className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-10 sm:pb-14">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 backdrop-blur-sm">
              <Warehouse className="w-4 h-4 text-amber-300" />
              <span className="text-xs sm:text-sm font-semibold text-amber-200">
                Stock Management workspace
              </span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              Inventory &amp;{" "}
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                availability
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed font-light">
              Manage inventory, track stock levels across warehouses, and monitor product availability
              in real time.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24 lg:pb-28">
          <div className="max-w-6xl mx-auto">
            <div className="mb-10 sm:mb-12">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                  Modules
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-2">Choose a view</h2>
              <p className="text-slate-400 text-lg font-light max-w-2xl">
                Real-time inventory tracking, multi-warehouse management, and pipeline integration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.href}
                    className="crm-feature-card-enhanced group relative overflow-hidden rounded-2xl h-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 group-hover:border-amber-500/60" />
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${module.accent} rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                    />
                    <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
                      <div className="inline-flex items-center gap-3">
                        <div
                          className={`inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br ${module.accent} shadow-lg`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                            {module.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-amber-300 font-medium">
                            {module.subtitle}
                          </p>
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light flex-grow">
                        {module.description}
                      </p>
                      <Link
                        to={module.href}
                        className={`inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r ${module.accent} text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl ${module.accentHover} hover:-translate-y-1 active:translate-y-0 group/btn w-fit`}
                      >
                        {module.cta}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
