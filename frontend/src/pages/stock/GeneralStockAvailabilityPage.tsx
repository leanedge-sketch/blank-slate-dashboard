import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Warehouse,
  TrendingUp,
  TrendingDown,
  Package,
  Search,
  ArrowRight,
  MapPin,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import {
  fetchStockAvailability,
  StockAvailabilitySummary,
  fetchStockMovements,
  StockMovement,
} from "../../services/api";

export function GeneralStockAvailabilityPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<StockAvailabilitySummary[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"total" | "per-product">("total");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStockData();
  }, []);

  async function loadStockData() {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch movements with pagination to get all (API limit is 1000 per request)
      const movementsData = await fetchStockMovements({ limit: 1000 });
      let allMovements = movementsData.movements;
      
      // If we got the full limit, there might be more - fetch additional pages
      if (movementsData.movements.length === 1000 && movementsData.total > 1000) {
        const totalPages = Math.ceil(movementsData.total / 1000);
        const additionalRequests = [];
        for (let page = 1; page < totalPages; page++) {
          additionalRequests.push(fetchStockMovements({ limit: 1000, offset: page * 1000 }));
        }
        const additionalResults = await Promise.all(additionalRequests);
        additionalResults.forEach((result) => {
          allMovements = [...allMovements, ...result.movements];
        });
      }
      
      const [availabilityData] = await Promise.all([
        fetchStockAvailability({ limit: 1000 }),
      ]);
      
      setStockData(availabilityData);
      setStockMovements(allMovements);
    } catch (err: any) {
      console.error(err);
      // Extract error message properly - handle validation errors
      let errorMessage = "Failed to load stock data";
      if (err?.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (err.response.data.detail) {
          // Handle Pydantic validation errors
          if (Array.isArray(err.response.data.detail)) {
            errorMessage = err.response.data.detail.map((d: any) => d.msg || String(d)).join(', ');
          } else {
            errorMessage = String(err.response.data.detail);
          }
        } else if (err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = stockData.filter(
    (item) =>
      item.chemical.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stock by brand directly from stock_movements if view mode is "per-product"
  const { displayData, brandMovementsMap, productMovementsMap } = viewMode === "per-product" 
    ? (() => {
        // Get all unique brands from stock_movements (from stock_movement.brand column)
        const brandsSet = new Set<string>();
        stockMovements.forEach((movement) => {
          if (movement.brand) {
            brandsSet.add(movement.brand);
          }
        });
        
        // Create aggregated display data grouped by brand - calculated from movements
        const aggregatedBrands: Array<{
          brand: string;
          addis_ababa_available: number;
          sez_kenya_available: number;
          nairobi_partner_available: number;
          total_available: number;
          product_entries: StockAvailabilitySummary[];
        }> = [];
        
        // For each unique brand, calculate stock from movements
        brandsSet.forEach((brand) => {
          // Filter movements by this brand
          const brandMovements = stockMovements.filter(
            (m) => (m.brand || "").toLowerCase().trim() === brand.toLowerCase().trim()
          );
          
          if (brandMovements.length === 0) return;
          
          // Calculate stock for each location using the same logic as backend
          let total_addis_ababa = 0.0;
          let total_sez_kenya = 0.0;
          let total_nairobi_partner = 0.0;
          
          // Track Nairobi Partner Stock Availability entries separately
          const nairobi_stock_availability: StockMovement[] = [];
          
          // Sort movements by date and created_at (oldest first for chronological processing)
          const sortedMovements = [...brandMovements].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) {
              return dateA - dateB;
            }
            const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return createdA - createdB;
          });
          
          // Process movements chronologically
          for (const movement of sortedMovements) {
            const location = (movement.location || "").toLowerCase().trim();
            
            // For Stock Availability transaction type at Nairobi Partner, track it separately
            if (movement.transaction_type === "Stock Availability" && location === "nairobi_partner") {
              nairobi_stock_availability.push(movement);
            }
            // Handle inter-company transfers from SEZ Kenya (special handling)
            else if (movement.transaction_type === "Inter-company transfer" && location === "sez_kenya" && movement.inter_company_transfer_kg > 0) {
              // Subtract from SEZ Kenya
              total_sez_kenya -= movement.inter_company_transfer_kg;
              // Add to destination location
              if (movement.transfer_to_location) {
                const transfer_to = movement.transfer_to_location.toLowerCase().trim();
                if (transfer_to === "addis_ababa") {
                  total_addis_ababa += movement.inter_company_transfer_kg;
                } else if (transfer_to === "sez_kenya") {
                  total_sez_kenya += movement.inter_company_transfer_kg;
                } else if (transfer_to === "nairobi_partner") {
                  total_nairobi_partner += movement.inter_company_transfer_kg;
                }
              }
            }
            else {
              // Regular transaction handling
              const net_change = (
                (movement.purchase_kg || 0) +
                (movement.purchase_direct_shipment_kg || 0) -
                (movement.sold_kg || 0) -
                (movement.sold_direct_shipment_kg || 0) -
                (movement.sample_or_damage_kg || 0)
              );
              
              // Apply net change to the appropriate location
              if (location === "addis_ababa") {
                total_addis_ababa += net_change;
              } else if (location === "sez_kenya") {
                total_sez_kenya += net_change;
              } else if (location === "nairobi_partner") {
                // Only add to Nairobi Partner if it's not Stock Availability
                total_nairobi_partner += net_change;
              }
            }
          }
          
          // For Nairobi Partner, use the latest Stock Availability balance if available
          if (nairobi_stock_availability.length > 0) {
            // Get the most recent Stock Availability entry by date
            const latest_stock_avail = nairobi_stock_availability.reduce((latest, current) => {
              const latestDate = new Date(latest.date).getTime();
              const currentDate = new Date(current.date).getTime();
              if (currentDate > latestDate) return current;
              if (currentDate < latestDate) return latest;
              // If dates are equal, compare created_at
              const latestCreated = latest.created_at ? new Date(latest.created_at).getTime() : 0;
              const currentCreated = current.created_at ? new Date(current.created_at).getTime() : 0;
              return currentCreated > latestCreated ? current : latest;
            });
            total_nairobi_partner = latest_stock_avail.balance_kg || 0;
          }
          
          // Ensure non-negative values
          total_addis_ababa = Math.max(0, total_addis_ababa);
          total_sez_kenya = Math.max(0, total_sez_kenya);
          total_nairobi_partner = Math.max(0, total_nairobi_partner);
          
          // Get product entries from stockData that match this brand (for sub-table display)
          const brandProducts = filteredData.filter(
            (item) => (item.brand || "").toLowerCase().trim() === brand.toLowerCase().trim()
          );
          
          aggregatedBrands.push({
            brand: brand,
            addis_ababa_available: total_addis_ababa,
            sez_kenya_available: total_sez_kenya,
            nairobi_partner_available: total_nairobi_partner,
            total_available: total_addis_ababa + total_sez_kenya + total_nairobi_partner,
            product_entries: brandProducts,
          });
        });
        
        // Create map of brand to product entries for sub-tables
        const movementsMap = new Map<string, StockAvailabilitySummary[]>();
        aggregatedBrands.forEach((brandData) => {
          const key = (brandData.brand || "").toLowerCase().trim();
          movementsMap.set(key, brandData.product_entries);
        });
        
        // Convert to display format
        const displayData = aggregatedBrands.map((brandData) => ({
          product_id: `brand-${(brandData.brand || "").toLowerCase().trim()}`,
          product_name: brandData.brand + (brandData.product_entries.length > 0 ? ` (${brandData.product_entries.length} products)` : ""),
          chemical: brandData.brand,
          brand: brandData.brand,
          addis_ababa_available: brandData.addis_ababa_available,
          sez_kenya_available: brandData.sez_kenya_available,
          nairobi_partner_available: brandData.nairobi_partner_available,
          total_available: brandData.total_available,
          addis_ababa_reserved: 0,
          sez_kenya_reserved: 0,
          nairobi_partner_reserved: 0,
        }));
        
        return {
          displayData,
          brandMovementsMap: movementsMap,
          productMovementsMap: undefined,
        };
      })()
    : (() => {
        // For "total" mode, create a map of product_id to movements/brands for expandable rows
        const productMovementsMap = new Map<string, StockMovement[]>();
        
        // Group movements by product_id
        stockMovements.forEach((movement) => {
          const productId = movement.product_id;
          if (productId) {
            if (!productMovementsMap.has(productId)) {
              productMovementsMap.set(productId, []);
            }
            productMovementsMap.get(productId)!.push(movement);
          }
        });
        
        return {
          displayData: filteredData,
          brandMovementsMap: new Map<string, StockAvailabilitySummary[]>(),
          productMovementsMap: productMovementsMap, // Add product movements map for "total" mode
        };
      })();

  const toggleProduct = (identifier: string) => {
    const key = (identifier || "").toLowerCase().trim();
    if (!key) return;
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedProducts(newExpanded);
  };

  // Calculate totals from display data
  const totals = displayData.reduce(
    (acc, item) => ({
      addis_ababa: acc.addis_ababa + item.addis_ababa_available,
      sez_kenya: acc.sez_kenya + item.sez_kenya_available,
      nairobi_partner: acc.nairobi_partner + item.nairobi_partner_available,
      total: acc.total + item.total_available,
    }),
    { addis_ababa: 0, sez_kenya: 0, nairobi_partner: 0, total: 0 }
  );

  function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading stock data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{String(error)}</p>
          <button
            onClick={loadStockData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/stock")}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold mb-2">General Stock Availability</h1>
                <p className="text-slate-300">Total stock across Addis Ababa, SEZ Kenya, and Nairobi Partner locations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg">
                <Package className="w-5 h-5 text-blue-400" />
                <span className="font-semibold">{filteredData.length} Products</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Addis Ababa</h3>
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatNumber(totals.addis_ababa)} kg</p>
            <p className="text-sm text-slate-500 mt-2">Available stock in Ethiopia</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">SEZ Kenya</h3>
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatNumber(totals.sez_kenya)} kg</p>
            <p className="text-sm text-slate-500 mt-2">Purchase & transfer stock</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Nairobi Partner</h3>
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatNumber(totals.nairobi_partner)} kg</p>
            <p className="text-sm text-slate-500 mt-2">Partner supplier stock</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Total Available</h3>
              <Warehouse className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{formatNumber(totals.total)} kg</p>
            <p className="text-sm text-slate-500 mt-2">Combined available stock</p>
          </div>
        </div>

        {/* Search and View Mode */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by chemical, brand, or product name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              View Mode:
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "total" | "per-product")}
              className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
            >
              <option value="total">Total (kg)</option>
              <option value="per-product">Total (kg) per Product</option>
            </select>
          </div>
        </div>

        {/* Stock Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Addis Ababa (kg)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    SEZ Kenya (kg)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Nairobi Partner (kg)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {viewMode === "per-product" ? "Total (kg) per Product" : "Total (kg)"}
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      No products found
                    </td>
                  </tr>
                ) : (
                  displayData.map((item, index) => {
                    // For "per-product" mode, use brand as key; for "total" mode, use product_id
                    const expandKey = viewMode === "per-product" 
                      ? (item.brand || "").toLowerCase().trim()
                      : item.product_id;
                    const isExpanded = expandedProducts.has(expandKey);
                    
                    // Get movements based on view mode
                    const movements = viewMode === "per-product"
                      ? (brandMovementsMap.get((item.brand || "").toLowerCase().trim()) || [])
                      : (productMovementsMap?.get(item.product_id) || []);
                    
                    // For "total" mode, group movements by brand to show in sub-table
                    const movementsByBrand = viewMode === "total" && movements.length > 0
                      ? (() => {
                          const brandMap = new Map<string, StockMovement[]>();
                          movements.forEach((m) => {
                            const brand = m.brand || "No Brand";
                            if (!brandMap.has(brand)) {
                              brandMap.set(brand, []);
                            }
                            brandMap.get(brand)!.push(m);
                          });
                          return brandMap;
                        })()
                      : new Map<string, StockMovement[]>();
                    
                    return (
                      <React.Fragment key={`${item.product_id}-${index}`}>
                        <tr
                          className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {movements.length > 0 && (
                                <button
                                  onClick={() => toggleProduct(expandKey)}
                                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                  )}
                                </button>
                              )}
                        <div>
                          <p className="font-semibold text-slate-900">{item.product_name}</p>
                                {viewMode === "total" && (
                          <p className="text-sm text-slate-500">{item.chemical}</p>
                                )}
                                {viewMode === "per-product" && item.brand && (
                                  <p className="text-sm text-slate-500">Brand: {item.brand}</p>
                                )}
                              </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.addis_ababa_available > 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`font-semibold ${
                              item.addis_ababa_available > 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {formatNumber(item.addis_ababa_available)}
                          </span>
                        </div>
                        {item.addis_ababa_reserved > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Reserved: {formatNumber(item.addis_ababa_reserved)} kg
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.sez_kenya_available > 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`font-semibold ${
                              item.sez_kenya_available > 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {formatNumber(item.sez_kenya_available)}
                          </span>
                        </div>
                        {item.sez_kenya_reserved > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Reserved: {formatNumber(item.sez_kenya_reserved)} kg
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.nairobi_partner_available > 0 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span
                            className={`font-semibold ${
                              item.nairobi_partner_available > 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {formatNumber(item.nairobi_partner_available)}
                          </span>
                        </div>
                        {item.nairobi_partner_reserved > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Reserved: {formatNumber(item.nairobi_partner_reserved)} kg
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-slate-900">
                          {formatNumber(item.total_available)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                            {viewMode === "total" ? (
                              movements.length > 0 ? (
                                <span className="text-sm text-slate-500">
                                  {movements.length} {movements.length === 1 ? "movement" : "movements"}
                                </span>
                              ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stock/products/${item.product_id}`);
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Details
                          <ArrowRight className="w-4 h-4" />
                        </button>
                              )
                            ) : (
                              <span className="text-sm text-slate-500">
                                {movements.length} {movements.length === 1 ? "product" : "products"}
                              </span>
                            )}
                          </td>
                        </tr>
                        {/* Expandable sub-table for "per-product" mode (products for brand) */}
                        {viewMode === "per-product" && isExpanded && movements.length > 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-slate-50">
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                                  <h4 className="text-sm font-semibold text-slate-700">
                                    Products for Brand: {item.brand}
                                  </h4>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                          Product
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Addis Ababa (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          SEZ Kenya (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Nairobi Partner (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Total (kg)
                                        </th>
                                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 uppercase">
                                          Actions
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {movements.map((movementItem) => (
                                        <tr
                                          key={movementItem.product_id}
                                          className="hover:bg-slate-50 transition-colors cursor-pointer"
                                          onClick={() => navigate(`/stock/products/${movementItem.product_id}`)}
                                        >
                                          <td className="px-4 py-3">
                                            <div>
                                              <p className="font-medium text-slate-900">{movementItem.product_name}</p>
                                              <p className="text-xs text-slate-500">{movementItem.chemical}</p>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              {movementItem.addis_ababa_available > 0 ? (
                                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <TrendingDown className="w-3 h-3 text-red-600" />
                                              )}
                                              <span
                                                className={`text-sm font-semibold ${
                                                  movementItem.addis_ababa_available > 0 ? "text-emerald-600" : "text-red-600"
                                                }`}
                                              >
                                                {formatNumber(movementItem.addis_ababa_available)}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              {movementItem.sez_kenya_available > 0 ? (
                                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <TrendingDown className="w-3 h-3 text-red-600" />
                                              )}
                                              <span
                                                className={`text-sm font-semibold ${
                                                  movementItem.sez_kenya_available > 0 ? "text-emerald-600" : "text-red-600"
                                                }`}
                                              >
                                                {formatNumber(movementItem.sez_kenya_available)}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              {movementItem.nairobi_partner_available > 0 ? (
                                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <TrendingDown className="w-3 h-3 text-red-600" />
                                              )}
                                              <span
                                                className={`text-sm font-semibold ${
                                                  movementItem.nairobi_partner_available > 0 ? "text-emerald-600" : "text-red-600"
                                                }`}
                                              >
                                                {formatNumber(movementItem.nairobi_partner_available)}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-3 text-right">
                                            <span className="text-sm font-bold text-slate-900">
                                              {formatNumber(movementItem.total_available)}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/stock/products/${movementItem.product_id}`);
                                              }}
                                              className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                            >
                                              View
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {/* Expandable sub-table for "total" mode (movements/brands for product) */}
                        {viewMode === "total" && isExpanded && movements.length > 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 bg-slate-50">
                              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200">
                                  <h4 className="text-sm font-semibold text-slate-700">
                                    Stock Movements for Product: {item.product_name}
                                  </h4>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                      <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                          Date
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                          Brand
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                          Location
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">
                                          Type
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Purchase (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Sold (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Transfer (kg)
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">
                                          Balance (kg)
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                      {movements
                                        .sort((a, b) => {
                                          const dateA = new Date(a.date).getTime();
                                          const dateB = new Date(b.date).getTime();
                                          if (dateA !== dateB) return dateB - dateA; // Newest first
                                          const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
                                          const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
                                          return createdB - createdA;
                                        })
                                        .map((movement) => (
                                          <tr
                                            key={movement.id}
                                            className="hover:bg-slate-50 transition-colors"
                                          >
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                              {new Date(movement.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                              {movement.brand ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                  {movement.brand}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">—</span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900 capitalize">
                                              {movement.location?.replace("_", " ") || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                              {movement.transaction_type || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-emerald-600">
                                              {movement.purchase_kg > 0 ? formatNumber(movement.purchase_kg) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-red-600">
                                              {movement.sold_kg > 0 ? formatNumber(movement.sold_kg) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right text-blue-600">
                                              {movement.inter_company_transfer_kg > 0 ? formatNumber(movement.inter_company_transfer_kg) : "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                                              {formatNumber(movement.balance_kg)} {movement.unit || "kg"}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                      </td>
                    </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

