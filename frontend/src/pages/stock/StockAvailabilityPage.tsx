import { Link } from "react-router-dom";
import {
  Warehouse,
  Package,
  ArrowRight,
} from "lucide-react";

export function StockAvailabilityPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Stock Management</h1>
            <p className="text-slate-300">Manage inventory, track stock levels, and monitor product availability</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Label Stock card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg border border-slate-200">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
              <div className="inline-flex items-center gap-3">
                <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    Product Label Stock
                  </h2>
                  <p className="text-xs sm:text-sm text-indigo-600 font-medium">
                    Product Labels · Stock Tracking · Movements
                  </p>
                </div>
              </div>

              <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-light">
                Monitor product label stock and detailed stock movements. Track product labels, inventory flow, and stock movements in real-time.
              </p>

              <ul className="text-slate-700 text-sm space-y-2 list-disc list-inside">
                <li>Product label stock tracking</li>
                <li>Stock movement visualization</li>
                <li>Movement history and audit trail</li>
                <li>Integration with sales pipeline</li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/stock/product-label"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                >
                  View Product Labels
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

          {/* General Stock Availability card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg border border-slate-200">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-7 sm:p-8 flex flex-col h-full gap-5">
              <div className="inline-flex items-center gap-3">
                <div className="inline-flex w-12 h-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
                  <Warehouse className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                    General Stock Availability
                  </h2>
                  <p className="text-xs sm:text-sm text-teal-600 font-medium">
                    General Overview · Inventory Status · Availability
                  </p>
                </div>
              </div>

              <p className="text-slate-700 text-sm sm:text-base leading-relaxed font-light">
                Get a comprehensive overview of stock availability across all products. Monitor inventory levels, check availability status, and manage stock efficiently.
              </p>

              <ul className="text-slate-700 text-sm space-y-2 list-disc list-inside">
                <li>General stock availability overview</li>
                <li>Product availability status</li>
                <li>Inventory level monitoring</li>
                <li>Quick stock status checks</li>
              </ul>

              <div className="pt-2">
                <Link
                  to="/stock/general-availability"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/40 hover:-translate-y-1 active:translate-y-0 group/btn"
                >
                  View Availability
                  <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

