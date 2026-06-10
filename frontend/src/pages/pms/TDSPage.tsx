import { Link } from "react-router-dom";
import { FileText, ChevronLeft } from "lucide-react";
import { TDS_MASTER_COLUMNS } from "../../utils/tdsMasterColumns";

export function TDSPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Link
                to="/pms"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                PMS · TDS Master Data
              </p>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
              <FileText className="text-emerald-400" size={32} />
              TDS Master Data
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Column layout for Technical Data Sheets. Rows will be added later — the catalog is
              empty until TDS documents are uploaded and linked.
            </p>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <p className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
            Reserved columns — no TDS data loaded. Upload and linking will be enabled in a future
            update.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  {TDS_MASTER_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    colSpan={TDS_MASTER_COLUMNS.length}
                    className="px-4 py-16 text-center text-slate-500"
                  >
                    No TDS records — columns ready for data to be added later.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
