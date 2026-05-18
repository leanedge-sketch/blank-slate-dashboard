import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  MapPin,
  Building2,
  Plus,
  Edit,
  Trash2,
  Filter,
} from "lucide-react";
import {
  fetchStockProductById,
  fetchStockMovements,
  Product,
  StockMovement,
  createStockMovement,
  updateStockMovement,
  deleteStockMovement,
  StockMovementCreate,
} from "../../services/api";

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
  const [activeLocationTab, setActiveLocationTab] = useState<string>("addis_ababa");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>("all");
  const [formData, setFormData] = useState<StockMovementCreate>({
    product_id: productId || "",
    tds_id: null,
    date: new Date().toISOString().split("T")[0],
    location: "addis_ababa",
    transaction_type: "Purchase",
    unit: "kg",
    beginning_balance: 0,
    purchase_kg: 0,
    sold_kg: 0,
    purchase_direct_shipment_kg: 0,
    sold_direct_shipment_kg: 0,
    sample_or_damage_kg: 0,
    inter_company_transfer_kg: 0,
    transfer_to_location: null,
    reference: "",
    remark: "",
    business_model: null,
    supplier_id: null,
    supplier_name: null,
    customer_id: null,
    customer_name: null,
    warehouse: "",
  });

  useEffect(() => {
    if (productId) {
      loadProductData();
    }
  }, [productId]);

  async function loadProductData() {
    if (!productId) return;

    try {
      setLoading(true);
      setError(null);

      const [productData, movementsData] = await Promise.all([
        fetchStockProductById(productId),
        fetchStockMovements({ product_id: productId, limit: 1000 }),
      ]);

      // Sort movements by date (oldest first) for chronological history
      const sortedMovements = [...movementsData.movements].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB; // Sort by date ascending
        }
        // If dates are equal, sort by created_at
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdA - createdB;
      });

      setProduct(productData);
      setMovements(sortedMovements);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load product data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;

    try {
      if (editingMovement) {
        await updateStockMovement(editingMovement.id, formData);
      } else {
        await createStockMovement({ ...formData, product_id: productId });
      }
      setShowAddForm(false);
      setEditingMovement(null);
      resetForm();
      loadProductData();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save movement");
    }
  }

  async function handleDelete(movementId: string) {
    if (!confirm("Are you sure you want to delete this movement?")) return;

    try {
      await deleteStockMovement(movementId);
      loadProductData();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to delete movement");
    }
  }

  function startEdit(movement: StockMovement) {
    setEditingMovement(movement);
    setFormData({
      product_id: movement.product_id,
      tds_id: movement.tds_id || null,
      date: movement.date,
      location: movement.location,
      transaction_type: movement.transaction_type,
      unit: movement.unit || "kg",
      beginning_balance: movement.beginning_balance,
      purchase_kg: movement.purchase_kg,
      sold_kg: movement.sold_kg,
      purchase_direct_shipment_kg: movement.purchase_direct_shipment_kg,
      sold_direct_shipment_kg: movement.sold_direct_shipment_kg,
      sample_or_damage_kg: movement.sample_or_damage_kg,
      inter_company_transfer_kg: movement.inter_company_transfer_kg,
      transfer_to_location: movement.transfer_to_location || null,
      supplier_id: movement.supplier_id || null,
      supplier_name: movement.supplier_name || null,
      customer_id: movement.customer_id || null,
      customer_name: movement.customer_name || null,
      business_model: movement.business_model || null,
      reference: movement.reference || "",
      remark: movement.remark || "",
      warehouse: movement.warehouse || "",
    });
    setShowAddForm(true);
  }

  function resetForm() {
    setFormData({
      product_id: productId || "",
      tds_id: null,
      date: new Date().toISOString().split("T")[0],
      location: "addis_ababa",
      transaction_type: "Purchase",
      unit: "kg",
      beginning_balance: 0,
      purchase_kg: 0,
      sold_kg: 0,
      purchase_direct_shipment_kg: 0,
      sold_direct_shipment_kg: 0,
      sample_or_damage_kg: 0,
      inter_company_transfer_kg: 0,
      transfer_to_location: null,
      reference: "",
      remark: "",
      business_model: null,
      supplier_id: null,
      supplier_name: null,
      customer_id: null,
      customer_name: null,
      warehouse: "",
    });
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Filter movements based on selected location tab and transaction type
  const filteredMovements = movements.filter((m) => {
    // Normalize location values to handle any case differences
    const movementLocation = (m.location || "").toLowerCase().trim();
    const activeTab = activeLocationTab.toLowerCase().trim();
    const locationMatch = movementLocation === activeTab;
    const typeMatch = transactionTypeFilter === "all" || m.transaction_type === transactionTypeFilter;
    return locationMatch && typeMatch;
  });

  // Get location display name
  const getLocationName = (location: string): string => {
    switch (location) {
      case "addis_ababa":
        return "Addis Ababa";
      case "sez_kenya":
        return "SEZ Kenya";
      case "nairobi_partner":
        return "Nairobi Partner";
      default:
        return location.replace("_", " ");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading product data...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Product not found"}</p>
          <button
            onClick={() => navigate("/stock")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Stock
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
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  {product.chemical} - {product.brand}
                </h1>
                <p className="text-slate-300">
                  {product.chemical_type} · {product.packaging}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingMovement(null);
                resetForm();
                setShowAddForm(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Movement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Product Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Addis Ababa</h3>
              <MapPin className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {formatNumber(product.available_stock_addis_ababa)} kg
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-semibold">{formatNumber(product.total_stock_addis_ababa)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved:</span>
                <span className="font-semibold">{formatNumber(product.reserved_stock_addis_ababa)} kg</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">SEZ Kenya</h3>
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {formatNumber(product.available_stock_sez_kenya)} kg
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-semibold">{formatNumber(product.total_stock_sez_kenya)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved:</span>
                <span className="font-semibold">{formatNumber(product.reserved_stock_sez_kenya)} kg</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-600">Nairobi Partner</h3>
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {formatNumber(product.available_stock_nairobi_partner)} kg
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-semibold">{formatNumber(product.total_stock_nairobi_partner)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved:</span>
                <span className="font-semibold">{formatNumber(product.reserved_stock_nairobi_partner)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Location Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="border-b border-slate-200">
            <div className="flex space-x-1 px-6 pt-4">
              <button
                onClick={() => setActiveLocationTab("addis_ababa")}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeLocationTab === "addis_ababa"
                    ? "border-emerald-600 text-emerald-600 bg-emerald-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Addis Ababa
                </div>
              </button>
              <button
                onClick={() => setActiveLocationTab("sez_kenya")}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeLocationTab === "sez_kenya"
                    ? "border-amber-600 text-amber-600 bg-amber-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  SEZ Kenya
                </div>
              </button>
              <button
                onClick={() => setActiveLocationTab("nairobi_partner")}
                className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeLocationTab === "nairobi_partner"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Nairobi Partner
                </div>
              </button>
            </div>
          </div>

          {/* Transaction Type Filter */}
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  {getLocationName(activeLocationTab)} Stock Movements
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-700">Filter by Type:</label>
                <select
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="Purchase">Purchase</option>
                  <option value="Sales">Sales</option>
                  <option value="Inter-company transfer">Inter-company transfer</option>
                  <option value="Sample">Sample</option>
                  <option value="Damage">Damage</option>
                  <option value="Stock Availability">Stock Availability</option>
                </select>
              </div>
            </div>
          </div>

          {/* Stock Movements Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Customer/Partner
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                    Purchase ({filteredMovements[0]?.unit || "kg"})
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                    Sold ({filteredMovements[0]?.unit || "kg"})
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                    Balance ({filteredMovements[0]?.unit || "kg"})
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No movements found for {getLocationName(activeLocationTab)}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((movement) => {
                    const totalPurchase =
                      movement.purchase_kg + movement.purchase_direct_shipment_kg;
                    const totalSold = movement.sold_kg + movement.sold_direct_shipment_kg;
                    const customerOrPartner =
                      movement.transaction_type === "Purchase"
                        ? movement.supplier_name || "—"
                        : movement.transaction_type === "Sales"
                        ? movement.customer_name || "—"
                        : "—";

                    return (
                      <tr key={movement.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm">{formatDate(movement.date)}</td>
                        <td className="px-6 py-4 text-sm">
                          {movement.transaction_type === "Inter-company transfer" && movement.transfer_to_location ? (
                            <span>
                              {movement.transaction_type} - to{" "}
                              <span className="font-semibold text-blue-600">
                                {movement.transfer_to_location.replace("_", " ").toUpperCase()}
                              </span>
                            </span>
                          ) : (
                            movement.transaction_type
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {movement.transaction_type === "Purchase" && (
                            <span className="text-amber-600 font-medium">Partner: {customerOrPartner}</span>
                          )}
                          {movement.transaction_type === "Sales" && (
                            <span className="text-emerald-600 font-medium">Customer: {customerOrPartner}</span>
                          )}
                          {movement.transaction_type !== "Purchase" &&
                            movement.transaction_type !== "Sales" && <span>—</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-emerald-600">
                          {totalPurchase > 0 ? formatNumber(totalPurchase) : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-red-600">
                          {totalSold > 0 ? formatNumber(totalSold) : "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold">
                          {formatNumber(movement.balance_kg)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEdit(movement)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(movement.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
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
