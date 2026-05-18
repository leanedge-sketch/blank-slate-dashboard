import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Boxes, Sparkles, Users, TrendingUp, Warehouse, Activity, Zap } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function HomePage() {
  const { employeeData, employeeRole } = useAuth();
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black overflow-hidden">
      {/* Background orbs + grid (reuse CRM style) */}
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
        {/* Hero */}
        <section className="px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 lg:pt-28 pb-10 sm:pb-14">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/40 backdrop-blur-sm hover:border-blue-400/60 transition-all duration-300">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                LeanChem Connect · Unified AI workspace
              </span>
            </div>

            {/* Heading with Logo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-8">
              {/* Logo */}
              <div className="flex-shrink-0 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-emerald-500/20 rounded-3xl blur-xl"></div>
                <img
                  src="/logo.jpg"
                  alt="LeanChem Connect Logo"
                  className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-3xl object-contain shadow-2xl border-2 border-blue-500/40 bg-slate-900/80 backdrop-blur-md p-3 ring-2 ring-blue-500/20"
                  style={{ filter: 'contrast(1.1) brightness(1.05)' }}
                />
              </div>

              {/* Text Content */}
              <div className="flex-1 space-y-5 sm:space-y-6">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white tracking-tighter leading-tight">
                  <span className="block">One home for</span>
                  <span className="block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
                    CRM, PMS &amp; Stock
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-slate-300 max-w-3xl leading-relaxed font-light">
                  Manage customers, deals, products, stock inventory, and logistics from a single,
                  AI-augmented control center built for LeanChem&apos;s real-world
                  workflows.
                </p>
                
                {/* User Info Badge */}
                {employeeData && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
                      <p className="text-sm text-slate-300">
                        <span className="text-slate-400">Logged in as:</span>{" "}
                        <span className="font-semibold text-white">{employeeData.name || employeeData.email}</span>
                        {employeeRole && (
                          <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {employeeRole}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Workspace cards */}
        <section className="px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24 lg:pb-28">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* CRM card */}
            <div className="crm-feature-card-enhanced group relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 group-hover:border-blue-500/60" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
                <div className="inline-flex items-center gap-3">
                  <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      CRM Workspace
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 font-medium">
                      Customers · AI interactions · Profiles · Dashboards
                    </p>
                  </div>
                </div>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                  Track every customer conversation, capture AI-assisted notes,
                  and see a clear picture of your pipeline and priorities.
                </p>

                <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
                  <li>Customer list &amp; rich interaction history</li>
                  <li>Per-customer AI copilot for deals and product fit</li>
                  <li>CRM dashboard and reporting views</li>
                  <li>Customer profile and relationship tracking</li>
                </ul>

                <div className="pt-2">
                  <Link
                    to="/crm"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                  >
                    Enter CRM
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>

            {/* PMS card */}
            <div className="crm-feature-card-enhanced group relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 group-hover:border-emerald-500/60" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
                <div className="inline-flex items-center gap-3">
                  <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                    <Boxes className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      PMS Workspace
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-300 font-medium">
                      Products · TDS · Pricing · Logistics · Partners
                    </p>
                  </div>
                </div>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                  A dedicated space for LeanChem&apos;s product universe: SKUs,
                  technical datasheets, costing &amp; pricing, and logistics
                  flows—powered by the same AI stack.
                </p>

                <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
                  <li>Central library of chemical SKUs and TDS</li>
                  <li>Pricing logic connected to deals and customers</li>
                  <li>Logistics and lead-time planning hooks</li>
                  <li>AI assistance for formulation &amp; troubleshooting</li>
                </ul>

                <div className="pt-2">
                  <Link
                    to="/pms"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                  >
                    Enter PMS
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Sales Pipeline card */}
            <div className="crm-feature-card-enhanced group relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 group-hover:border-purple-500/60" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-400 to-rose-400 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
                <div className="inline-flex items-center gap-3">
                  <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      Sales Pipeline
                    </h2>
                    <p className="text-xs sm:text-sm text-purple-300 font-medium">
                      Deals · Quotes · Stages · Forecasting · AI Insights
                    </p>
                  </div>
                </div>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                  Track deals through the sales pipeline. Monitor stages, deal values, expected close dates, generate quotation drafts, and get AI-powered sales advice.
                </p>

                <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
                  <li>7-stage pipeline tracking (Lead ID to Closed)</li>
                  <li>Deal value and currency management</li>
                  <li>Quotation drafts aligned with LeanChem templates</li>
                  <li>AI-powered stage detection and forecasting</li>
                  <li>Product-specific sales assistant</li>
                </ul>

                <div className="pt-2">
                  <Link
                    to="/sales/pipeline"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                  >
                    View Pipeline
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Stock Management card */}
            <div className="crm-feature-card-enhanced group relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800/60 via-slate-900/40 to-black/40 rounded-2xl border border-slate-700/60 transition-all duration-500 group-hover:border-amber-500/60" />
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
                <div className="inline-flex items-center gap-3">
                  <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                    <Warehouse className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      Stock Management
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-300 font-medium">
                      Inventory · Warehouses · Tracking · Availability
                    </p>
                  </div>
                </div>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed font-light">
                  Manage inventory, track stock levels across warehouses, and monitor product availability in real-time.
                </p>

                <ul className="text-slate-300 text-sm space-y-2 list-disc list-inside">
                  <li>Real-time inventory tracking</li>
                  <li>Multi-warehouse management</li>
                  <li>Stock alerts and reorder points</li>
                  <li>Integration with sales pipeline</li>
                </ul>

                <div className="pt-2">
                  <Link
                    to="/stock"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                  >
                    View Stock
                    <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Stats / Features Section */}
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
              <div className="flex flex-wrap gap-4 text-slate-400 text-xs sm:text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>Customer-centric</span>
                </div>
                <div className="flex items-center gap-1">
                  <Boxes className="w-4 h-4 text-emerald-400" />
                  <span>Product Management</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span>Sales Pipeline</span>
                </div>
                <div className="flex items-center gap-1">
                  <Warehouse className="w-4 h-4 text-amber-400" />
                  <span>Stock Control</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
