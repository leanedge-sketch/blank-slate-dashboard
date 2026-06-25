import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { ExecutiveReportDashboard } from "../../components/executive-report/ExecutiveReportDashboard";

export function ExecutiveReportDashboardPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 sm:py-10 max-w-[1600px] mx-auto">
        <Link
          to="/reports"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Reports workspace
        </Link>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
          <LayoutDashboard className="h-3.5 w-3.5 text-violet-300" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200">
            Stage 4 BI module
          </span>
        </div>

        <ExecutiveReportDashboard />
      </div>
    </main>
  );
}
