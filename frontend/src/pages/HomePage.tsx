import {
  BarChart3,
  Boxes,
  FileText,
  Sparkles,
  Users,
  TrendingUp,
  Warehouse,
  Activity,
  Zap,
  Ship,
} from "lucide-react";
import { AtAGlanceSummary } from "../components/home/AtAGlanceSummary";
import { RecentlyAccessedShelf } from "../components/home/RecentlyAccessedShelf";
import { WorkspaceModuleCard } from "../components/home/WorkspaceModuleCard";

export function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 left-0 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      </div>

      <div className="relative z-10">
        <section className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-10 sm:pb-14">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 backdrop-blur-sm hover:border-blue-400/60 transition-all duration-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                LeanChem Connect · Unified AI workspace
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
              <div className="flex-shrink-0 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-3xl blur-xl"></div>
                <img
                  src="/logo.jpg"
                  alt="LeanChem Connect Logo"
                  className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-3xl object-contain shadow-2xl border-2 border-blue-500/40 bg-slate-900/80 backdrop-blur-md p-3 ring-2 ring-blue-500/20"
                  style={{ filter: "contrast(1.1) brightness(1.05)" }}
                />
              </div>

              <div className="flex-1 space-y-5 sm:space-y-6">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-tight">
                  <span className="block">One home for</span>
                  <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
                    CRM, PMS, Trade, Stock &amp; Reports
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed font-light">
                  Manage customers, deals, products, stock inventory, reports, and logistics from a single,
                  AI-augmented control center built for LeanChem&apos;s real-world
                  workflows.
                </p>
                <p className="text-xs text-slate-500">
                  Press <kbd className="rounded border border-slate-600 px-1">Ctrl</kbd>/
                  <kbd className="rounded border border-slate-600 px-1">⌘</kbd>
                  <kbd className="rounded border border-slate-600 px-1">K</kbd> to jump anywhere.
                </p>
              </div>
            </div>
          </div>
        </section>

        <AtAGlanceSummary />

        <section className="px-4 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <WorkspaceModuleCard
              module="crm"
              to="/crm"
              title="CRM Workspace"
              eyebrow="Customers · AI interactions · Profiles · Dashboard"
              description="Track every customer conversation, capture AI-assisted notes, and see a clear picture of your pipeline and priorities."
              bullets={[
                "Customer list & rich interaction history",
                "Per-customer AI copilot for deals and product fit",
                "CRM dashboard and ICP profiles",
              ]}
              cta="Enter CRM"
              icon={<Users className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-blue-600 to-cyan-600"
              hoverBorder="group-hover:border-blue-500/60"
            />
            <WorkspaceModuleCard
              module="pms"
              to="/pms"
              title="PMS Workspace"
              eyebrow="Products · TDS · Pricing · Logistics · Partners"
              description="A dedicated space for LeanChem's product universe: SKUs, technical datasheets, costing & pricing, and logistics flows—powered by the same AI stack."
              bullets={[
                "Central library of chemical SKUs and TDS",
                "Pricing logic connected to deals and customers",
                "Logistics and lead-time planning hooks",
                "AI assistance for formulation & troubleshooting",
              ]}
              cta="Enter PMS"
              icon={<Boxes className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-emerald-600 to-teal-600"
              hoverBorder="group-hover:border-emerald-500/60"
            />
            <WorkspaceModuleCard
              module="sales"
              to="/sales/pipeline"
              title="Sales Pipeline"
              eyebrow="Deals · Quotes · Stages · Forecasting · AI Insights"
              description="Track deals through the sales pipeline. Monitor stages, deal values, expected close dates, generate quotation drafts, and get AI-powered sales advice."
              bullets={[
                "7-stage pipeline tracking (Lead ID to Closed)",
                "Deal value and currency management",
                "Quotation drafts aligned with LeanChem templates",
                "AI-powered stage detection and forecasting",
                "Product-specific sales assistant",
              ]}
              cta="View Pipeline"
              icon={<TrendingUp className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-purple-600 to-pink-600"
              hoverBorder="group-hover:border-purple-500/60"
            />
            <WorkspaceModuleCard
              module="stock"
              to="/stock"
              title="Stock Management"
              eyebrow="Inventory · Warehouses · Tracking · Availability"
              description="Manage inventory, track stock levels across warehouses, and monitor product availability in real-time."
              bullets={[
                "Real-time inventory tracking",
                "Multi-warehouse management",
                "Stock alerts and reorder points",
                "Integration with sales pipeline",
              ]}
              cta="View Stock"
              icon={<Warehouse className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-amber-600 to-orange-600"
              hoverBorder="group-hover:border-amber-500/60"
            />
            <WorkspaceModuleCard
              module="reports"
              to="/reports"
              title="Reports & Analysis"
              eyebrow="Coverage · Pipeline · Forecast · Export"
              description="Pipeline, activity, and interaction intelligence from your data. Filter by date, track quiet customers, and export CSV or PDF for the team."
              bullets={[
                "Customer coverage and interaction volume",
                "Opportunity tracking and revenue forecast",
                "Weekly activity charts and quiet-customer lists",
                "CSV and PDF export for sharing",
              ]}
              cta="View Reports"
              icon={<FileText className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-rose-600 to-cyan-600"
              hoverBorder="group-hover:border-rose-500/60"
            />
            <WorkspaceModuleCard
              module="finance"
              to="/finance/import"
              title="Trade & Transit"
              eyebrow="Imports · Customs · Landed Cost · Margin"
              description="Simulate global supply chain costs, calculate customs waterfalls, and project local warehouse margins for import procurement."
              bullets={[
                "Moyale border & capital outlay tracking",
                "Editable customs fee rates & tax waterfalls",
                "Addis landed cost calculation",
                "Margin & target price forecasting",
              ]}
              cta="Open Pipeline"
              icon={<Ship className="w-6 h-6 text-white" />}
              accent="bg-gradient-to-r from-cyan-600 to-blue-600"
              hoverBorder="group-hover:border-cyan-500/60"
            />
          </div>
        </section>

        <RecentlyAccessedShelf />

        <section className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="flex items-start gap-4 p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
                <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <Activity className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Real-time Updates</h3>
                  <p className="text-slate-400 text-sm">Live data synchronization across all workspaces</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
                <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">AI-Powered</h3>
                  <p className="text-slate-400 text-sm">Intelligent assistance for every workflow</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 rounded-xl bg-slate-800/30 border border-slate-700/50 backdrop-blur-sm">
                <div className="p-3 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Data-Driven</h3>
                  <p className="text-slate-400 text-sm">Comprehensive analytics and insights</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pt-6 border-t border-slate-800/50">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <p className="text-slate-300 text-sm sm:text-base font-light">
                  LeanChem Connect · Unified Platform
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
