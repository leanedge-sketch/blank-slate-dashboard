import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Search,
  Plus,
  History,
  Building2,
  FileText,
  ArrowRight,
  Edit,
  Trash2,
  Calendar,
  MapPin,
} from "lucide-react";
import {
  fetchChemicalTypes,
  fetchTDS,
  fetchCustomers,
  fetchPartnerChemicals,
  fetchStockMovements,
  createStockMovement,
  updateStockMovement,
  deleteStockMovement,
  createStockProduct,
  fetchStockProductById,
  fetchStockProducts,
  StockMovement,
  StockMovementCreate,
  ProductCreate,
  Product,
  ChemicalType,
  Tds,
  Customer,
  PartnerChemical,
} from "../../services/api";

export function ProductLabelStockPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chemicalTypes, setChemicalTypes] = useState<ChemicalType[]>([]);
  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Use partner_chemicals as suppliers/vendors
  const [partners, setPartners] = useState<PartnerChemical[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ChemicalType | null>(null);
  const [selectedTds, setSelectedTds] = useState<Tds | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Partner | null>(null);
  const [stockProductId, setStockProductId] = useState<string | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeLocationTab, setActiveLocationTab] = useState<string>("addis_ababa");
  const [formData, setFormData] = useState<StockMovementCreate>({
    product_id: "",
    tds_id: null,
    date: new Date().toISOString().split("T")[0],
    location: "addis_ababa",
    transaction_type: "Purchase",
    unit: "kg",
    beginning_balance: 0,
    purchase_kg: 0,
    sold_kg: 0,
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
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      // Load TDS for selected chemical type
      loadTdsForChemicalType(selectedProduct.id);
    } else {
      setTdsList([]);
      setSelectedTds(null);
    }
  }, [selectedProduct]);

  async function loadTdsForChemicalType(chemicalTypeId: string) {
    try {
      const tdsRes = await fetchTDS({ 
        chemical_type_id: chemicalTypeId,
        limit: 1000 
      });
      setTdsList(tdsRes.tds || []);
      // If only one TDS, auto-select it and load movements
      if (tdsRes.tds && tdsRes.tds.length === 1) {
        const autoSelectedTds = tdsRes.tds[0];
        setSelectedTds(autoSelectedTds);
        // Load movements immediately when auto-selecting TDS
        await loadStockMovementsByBrandWithTds(autoSelectedTds);
      } else {
        setSelectedTds(null);
      }
    } catch (err) {
      console.error("Failed to load TDS:", err);
      setTdsList([]);
      setSelectedTds(null);
    }
  }

  // When a product is selected, always resolve (or create) the stock product.
  // This is independent of TDS/brand selection so that stock history
  // for the whole product is always available.
  useEffect(() => {
    if (selectedProduct) {
      findOrCreateStockProduct();
    } else {
      // If product is cleared, reset stock context
      setStockProductId(null);
      setStockProduct(null);
      setStockMovements([]);
    }
  }, [selectedProduct]);

  // Once we know the stock product ID, load its history.
  // This will fetch all movements for the product; location/brand
  // filtering is handled in the UI (tabs & columns).
  useEffect(() => {
    if (stockProductId) {
      loadStockHistory();
    }
  }, [stockProductId, selectedCustomer]);

  // Load stock movements by brand (from stock_movement.brand column) - with explicit TDS parameter
  async function loadStockMovementsByBrandWithTds(tds: Tds) {
    try {
      setLoadingMovements(true);
      // Combine brand and grade for the full brand name (matching how it's stored)
      const displayBrand = tds.brand || "";
      const fullBrand = tds.grade ? `${displayBrand} -- ${tds.grade}` : displayBrand;
      
      console.log("🔍 Loading movements for brand:", {
        displayBrand,
        fullBrand,
        tdsId: tds.id,
      });
      
      // Fetch movements with pagination to get all (API limit is 1000 per request)
      const movementsData = await fetchStockMovements({
        limit: 1000, // API max limit
      });
      
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
      
      // Filter movements by brand (case-insensitive, matching the format stored)
      const brandMovements = allMovements.filter((m) => {
        if (!m.brand) return false;
        // Match exact brand or try with/without grade separator
        const movementBrand = (m.brand || "").toLowerCase().trim();
        const searchBrand = fullBrand.toLowerCase().trim();
        const displayBrandLower = displayBrand.toLowerCase().trim();
        
        // Try multiple matching strategies
        const matches = movementBrand === searchBrand || 
               movementBrand === displayBrandLower ||
               movementBrand.includes(searchBrand) ||
               searchBrand.includes(movementBrand);
        
        if (matches) {
          console.log("✅ Matched movement:", {
            movementBrand: m.brand,
            movementId: m.id,
            location: m.location,
            date: m.date,
          });
        }
        
        return matches;
      });
      
      console.log(`📊 Found ${brandMovements.length} movements for brand "${fullBrand}" out of ${allMovements.length} total movements`);
      
      // Always set movements (even if empty) - this shows existing movements immediately
      // Sort movements by date (oldest first)
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
      setStockMovements(sortedMovements);
      
      // If we also have a product ID, load product data too
      if (stockProductId) {
        try {
          const productData = await fetchStockProductById(stockProductId);
          setStockProduct(productData);
        } catch (err) {
          // Product might not exist yet, that's okay
          console.log("Product data not available yet");
        }
      }
    } catch (err: any) {
      console.error("❌ Error loading movements by brand:", err);
      setStockMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }

  // Load stock movements by brand (from stock_movement.brand column) - using selectedTds state
  async function loadStockMovementsByBrand() {
    if (!selectedTds) {
      setStockMovements([]);
      return;
    }
    await loadStockMovementsByBrandWithTds(selectedTds);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [chemicalTypesRes, customersRes, partnersRes] = await Promise.all([
        fetchChemicalTypes({ limit: 1000 }),
        fetchCustomers({ limit: 1000 }),
        fetchPartnerChemicals({ limit: 1000 }),
      ]);
      setChemicalTypes(chemicalTypesRes.chemicals || []);
      setCustomers(customersRes.customers);
      setPartners(partnersRes.partner_chemicals);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function findOrCreateStockProduct() {
    if (!selectedProduct) return;

    try {
      const chemicalName = selectedProduct.name || "";
      if (!chemicalName) {
        setStockProductId(null);
        return;
      }
      
      // Search for products - try both exact match and partial match
      const products = await fetchStockProducts({
        limit: 1000, // Get more products to search through
      });
      
      // Look for a product that matches the chemical type name (case-insensitive)
      // This allows finding products even without TDS selected
      let matchingProduct = products.products.find(
        (p) => 
          (p.chemical && p.chemical.toLowerCase() === chemicalName.toLowerCase()) ||
          (p.chemical_type && p.chemical_type.toLowerCase() === chemicalName.toLowerCase())
      );
      
      // If TDS is selected, also try matching by TDS ID or brand (for more precise matching)
      if (!matchingProduct && selectedTds) {
        const tdsBrand = selectedTds.brand || "";
        matchingProduct = products.products.find(
          (p) => 
            (p.tds_id && p.tds_id === selectedTds.id) ||
            (p.brand && p.brand.toLowerCase() === tdsBrand.toLowerCase())
        );
      }
      
      if (matchingProduct) {
        setStockProductId(matchingProduct.id);
        console.log("✅ Found existing stock product:", matchingProduct.id, "for chemical:", chemicalName);
      } else {
        // If no product found, try to find product_id from movements by searching movements
        // This handles cases where movements exist but product record might be missing/not matching
        console.log("🔍 No stock product found, searching movements for product_id...");
        try {
          const movementsData = await fetchStockMovements({ limit: 1000 });
          // Try to find a movement that might match this chemical type
          // Look for movements where the product might be related
          const possibleMovement = movementsData.movements.find((m) => {
            // If movements exist with product_id, we can use that
            return m.product_id;
          });
          
          if (possibleMovement && possibleMovement.product_id) {
            // Verify this product_id actually exists and might match
            try {
              const productData = await fetchStockProductById(possibleMovement.product_id);
              // If product exists, use it (even if name doesn't match perfectly)
              setStockProductId(possibleMovement.product_id);
              console.log("✅ Found product via movements:", possibleMovement.product_id);
            } catch (err) {
              // Product doesn't exist, will be created when user adds first stock entry
              setStockProductId(null);
              console.log("⚠️ Product ID from movements doesn't exist in products table");
            }
          } else {
            setStockProductId(null);
            console.log("⚠️ No existing stock product or movements found for:", chemicalName);
          }
        } catch (movementErr) {
          setStockProductId(null);
          console.log("⚠️ No existing stock product found for:", chemicalName);
        }
      }
    } catch (err: any) {
      console.error("❌ Error finding stock product:", err);
      // Product doesn't exist, will be created when user adds first stock entry
      setStockProductId(null);
    }
  }

  async function loadStockHistory() {
    // Set loading state at the start
    setLoadingMovements(true);
    
    try {
      // If we have a selected TDS, prioritize loading by brand (even if product ID exists)
      // This ensures movements are filtered by brand as the user expects
      if (selectedTds) {
        console.log("📦 loadStockHistory: Selected TDS found, loading by brand instead");
        await loadStockMovementsByBrand();
        
        // Also load product data if we have a product ID
        if (stockProductId) {
          try {
            const productData = await fetchStockProductById(stockProductId);
            setStockProduct(productData);
          } catch (err) {
            console.error("Failed to load product data:", err);
          }
        }
        return;
      }

      // Load by product ID if we have one
      if (stockProductId) {
        try {
          console.log("📦 loadStockHistory: Loading by product_id:", stockProductId);
          const [productData, movementsData] = await Promise.all([
            fetchStockProductById(stockProductId),
            fetchStockMovements({
              product_id: stockProductId,
              limit: 1000,
            }),
          ]);
          
          setStockProduct(productData);
          console.log(`✅ Loaded ${movementsData.movements.length} movements for product ${stockProductId}`);
          
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
          setStockMovements(sortedMovements);
        } catch (err: any) {
          console.error("❌ Error loading stock history:", err);
          setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load stock history");
          setStockMovements([]);
        }
        return;
      }

      // If no stock product ID, try to search movements to find product_id
      // This handles cases where product exists but wasn't matched by name
      console.log("🔍 No product_id found, searching movements for any product that might match...");
      const movementsData = await fetchStockMovements({ limit: 1000 });
      
      // Get all unique product_ids from movements
      const productIds = new Set(movementsData.movements.map(m => m.product_id).filter(Boolean));
      
      if (productIds.size === 0) {
        console.log("⚠️ No movements found with product_id");
        setStockMovements([]);
        setStockProduct(null);
        return;
      }
      
      // Try to find a product that might match our chemical type
      // Check each product_id to see if any match
      for (const pid of productIds) {
        try {
          const productData = await fetchStockProductById(pid);
          const chemicalName = selectedProduct?.name?.toLowerCase() || "";
          const productChemical = (productData.chemical || "").toLowerCase();
          const productChemicalType = (productData.chemical_type || "").toLowerCase();
          
          // Check if product matches chemical type name
          if (chemicalName && (productChemical.includes(chemicalName) || productChemicalType.includes(chemicalName) || chemicalName.includes(productChemical) || chemicalName.includes(productChemicalType))) {
            console.log(`✅ Found matching product via movements: ${pid}`);
            setStockProductId(pid);
            setStockProduct(productData);
            
            // Now load movements for this product
            const matchingMovements = movementsData.movements.filter(m => m.product_id === pid);
            const sortedMovements = [...matchingMovements].sort((a, b) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              if (dateA !== dateB) return dateA - dateB;
              const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return createdA - createdB;
            });
            setStockMovements(sortedMovements);
            return;
          }
        } catch (err) {
          // Product doesn't exist or doesn't match, continue searching
          continue;
        }
      }
      
      // If no match found, show empty
      console.log("⚠️ No matching product found in movements for chemical:", selectedProduct?.name);
      setStockMovements([]);
      setStockProduct(null);
    } catch (err: any) {
      console.error("❌ Error searching movements:", err);
      setStockMovements([]);
    } finally {
      setLoadingMovements(false);
    }

    // Safety: stockProductId can be null while the UI is still initializing.
    if (!stockProductId) {
      setStockMovements([]);
      setStockProduct(null);
      return;
    }

    try {
      const [productData, movementsData] = await Promise.all([
        fetchStockProductById(stockProductId),
        fetchStockMovements({
          product_id: stockProductId,
          limit: 1000,
        }),
      ]);
      
      setStockProduct(productData);
      
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
      setStockMovements(sortedMovements);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load stock history");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) {
      alert("Please select a product first");
      return;
    }
    if (!selectedTds) {
      alert("Please select a brand (TDS) first");
      return;
    }

    try {
      // Ensure product exists in stock system
      let productId = stockProductId;
      
      if (!productId) {
        // Create product from Chemical Type
        const productData: ProductCreate = {
          chemical: selectedProduct.name || "Unknown",
          chemical_type: selectedProduct.name || "Unknown",
          brand: selectedProduct.name || "Unknown",
          packaging: "",
          kg_per_unit: 1.0, // Default
          use_case: "sales",
          tds_id: null, // Chemical type doesn't have a direct TDS link
          tds_link: null,
        };
        const createdProduct = await createStockProduct(productData);
        productId = createdProduct.id;
        setStockProductId(productId);
        // Reload stock history after creating product
        await loadStockHistory();
      }

      // Combine brand and grade for the full brand name
      const displayBrand = selectedTds?.brand || "";
      const fullBrand = selectedTds?.grade ? `${displayBrand} -- ${selectedTds.grade}` : displayBrand;
      
      const movementData: StockMovementCreate = {
        ...formData,
        product_id: productId,
        tds_id: selectedTds?.id || null,
        brand: fullBrand || formData.brand || null,
        customer_id: selectedCustomer?.customer_id || null,
        customer_name: selectedCustomer?.customer_name || null,
      };

      console.log("Creating movement with brand:", movementData.brand, "from TDS brand:", selectedTds?.brand, "grade:", selectedTds?.grade);

      if (editingMovement) {
        await updateStockMovement(editingMovement.id, movementData);
      } else {
        await createStockMovement(movementData);
      }

      setShowAddForm(false);
      setEditingMovement(null);
      resetForm();
      loadStockHistory();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save stock movement");
    }
  }

  async function handleDelete(movementId: string) {
    if (!confirm("Are you sure you want to delete this stock movement?")) return;

    try {
      await deleteStockMovement(movementId);
      loadStockHistory();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to delete movement");
    }
  }

  function startEdit(movement: StockMovement) {
    setEditingMovement(movement);
    setFormData({
      product_id: movement.product_id,
      tds_id: null, // Using Chemical Types, not TDS
      date: movement.date,
      location: movement.location,
      transaction_type: movement.transaction_type,
      beginning_balance: movement.beginning_balance,
      purchase_kg: movement.purchase_kg,
      sold_kg: movement.sold_kg,
      sample_or_damage_kg: movement.sample_or_damage_kg,
      inter_company_transfer_kg: movement.inter_company_transfer_kg,
      transfer_to_location: movement.transfer_to_location || null,
      supplier_id: movement.supplier_id || null,
      supplier_name: movement.supplier_name || null,
      customer_id: movement.customer_id || null,
      customer_name: movement.customer_name || null,
      business_model: movement.business_model || null,
      brand: movement.brand || null,
      unit: movement.unit || "kg",
      reference: movement.reference || "",
      remark: movement.remark || "",
    });
    // Set selected supplier/customer based on movement
    if (movement.supplier_id) {
      const supplier = partners.find((p) => p.id === movement.supplier_id);
      setSelectedSupplier(supplier || null);
    }
    if (movement.customer_id) {
      const customer = customers.find((c) => c.customer_id === movement.customer_id);
      setSelectedCustomer(customer || null);
    }
    setShowAddForm(true);
  }

  function resetForm() {
    setFormData({
      product_id: stockProductId || "",
      tds_id: null, // Using Chemical Types, not TDS
      date: new Date().toISOString().split("T")[0],
      location: "addis_ababa",
      transaction_type: "Purchase",
      unit: "kg",
      beginning_balance: 0,
      purchase_kg: 0,
      sold_kg: 0,
      sample_or_damage_kg: 0,
      inter_company_transfer_kg: 0,
      transfer_to_location: null,
      reference: "",
      remark: "",
      business_model: null,
      supplier_id: selectedSupplier?.id || null,
      supplier_name: selectedSupplier?.partner || null,
      customer_id: selectedCustomer?.customer_id || null,
      customer_name: selectedCustomer?.customer_name || null,
      brand: null,
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

  // Filter movements based on selected location tab
  const filteredMovements = stockMovements.filter((m) => {
    const movementLocation = (m.location || "").toLowerCase().trim();
    const activeTab = activeLocationTab.toLowerCase().trim();
    return movementLocation === activeTab;
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

  const filteredProducts = (chemicalTypes || []).filter(
    (chemicalType) =>
      (chemicalType.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chemicalType.category || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error && !selectedProduct) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadData}
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
            <div>
              <h1 className="text-3xl font-bold mb-2">Product Label Stock</h1>
              <p className="text-slate-300">Track stock by chemical type and customer</p>
            </div>
            {selectedProduct && (
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSelectedCustomer(null);
                  setStockMovements([]);
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Back to Products
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedProduct ? (
          /* Product Selection View */
          <div>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products by chemical name or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((chemicalType) => (
                <div
                  key={chemicalType.id}
                  onClick={() => setSelectedProduct(chemicalType)}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {chemicalType.name || "Unknown Chemical"}
                      </h3>
                      {chemicalType.category && (
                        <p className="text-sm text-slate-500">Category: {chemicalType.category}</p>
                      )}
                      {chemicalType.hs_code && (
                        <p className="text-xs text-slate-400 mt-1">HS Code: {chemicalType.hs_code}</p>
                      )}
                    </div>
                    <Package className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <History className="w-4 h-4" />
                    <span>View Stock History</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-slate-500">No products found</p>
              </div>
            )}
          </div>
        ) : (
          /* Stock Management View for Selected Product */
          <div>
            {/* Product Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    {selectedProduct.name || "Unknown Chemical"}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    {selectedProduct.category && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        Category: {selectedProduct.category}
                      </span>
                    )}
                    {selectedProduct.hs_code && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        HS Code: {selectedProduct.hs_code}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setSelectedTds(null);
                    setStockProductId(null);
                    setStockProduct(null);
                    setStockMovements([]);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Back to Products
                </button>
              </div>
              
              {/* Add Stock Entry Button */}
              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Stock Entry
                </button>
              </div>
            </div>

            {/* Stock Summary Cards */}
            {stockProduct && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Addis Ababa Stock */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-600">Addis Ababa</h3>
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatNumber(stockProduct.available_stock_addis_ababa)} kg
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.total_stock_addis_ababa)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reserved:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.reserved_stock_addis_ababa)} kg</span>
                    </div>
                  </div>
                </div>

                {/* SEZ Kenya Stock */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-600">SEZ Kenya</h3>
                    <MapPin className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatNumber(stockProduct.available_stock_sez_kenya)} kg
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.total_stock_sez_kenya)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reserved:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.reserved_stock_sez_kenya)} kg</span>
                    </div>
                  </div>
                </div>

                {/* Nairobi Partner Stock */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-600">Nairobi Partner</h3>
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-3xl font-bold text-slate-900">
                    {formatNumber(stockProduct.available_stock_nairobi_partner)} kg
                  </p>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.total_stock_nairobi_partner)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reserved:</span>
                      <span className="font-semibold">{formatNumber(stockProduct.reserved_stock_nairobi_partner)} kg</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Add/Edit Form */}
            {showAddForm && (
              <>
                {/* Transaction Type Selection */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Transaction Type *
                  </label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => {
                      const newType = e.target.value as
                        | "Sales"
                        | "Purchase"
                        | "Inter-company transfer"
                        | "Sample"
                        | "Damage"
                        | "Stock Availability";
                      // Reset all quantity fields when transaction type changes
                      setFormData({
                        ...formData,
                        transaction_type: newType,
                        location:
                          newType === "Stock Availability" ? "nairobi_partner" : formData.location,
                        purchase_kg: 0,
                        sold_kg: 0,
                        sample_or_damage_kg: 0,
                        inter_company_transfer_kg: 0,
                        transfer_to_location: null,
                        customer_id: null,
                        customer_name: null,
                        supplier_id: null,
                        supplier_name: null,
                      });
                      setSelectedCustomer(null);
                      setSelectedSupplier(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Purchase">Purchase</option>
                    <option value="Sales">Sales</option>
                    <option value="Inter-company transfer">Inter-company transfer</option>
                    <option value="Sample">Sample</option>
                    <option value="Damage">Damage</option>
                    <option value="Stock Availability">Stock Availability (Nairobi Partner only)</option>
                  </select>
                </div>

                {/* Supplier/Customer Selection - based on transaction type */}
                {formData.transaction_type === "Sales" && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Customer *
                    </label>
                    <select
                      value={selectedCustomer?.customer_id || ""}
                      onChange={(e) => {
                        const customer = customers.find((c) => c.customer_id === e.target.value);
                        setSelectedCustomer(customer || null);
                        setFormData({
                          ...formData,
                          customer_id: customer?.customer_id || null,
                          customer_name: customer?.customer_name || null,
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map((customer) => (
                        <option key={customer.customer_id} value={customer.customer_id}>
                          {customer.customer_name} {customer.display_id ? `(${customer.display_id})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {formData.transaction_type === "Purchase" && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Supplier (Partner) *
                    </label>
                    <select
                      value={selectedSupplier?.id || ""}
                      onChange={(e) => {
                        const supplier = partners.find((p) => p.id === e.target.value);
                        setSelectedSupplier(supplier || null);
                        setFormData({
                          ...formData,
                          supplier_id: supplier?.id || null,
                          supplier_name: supplier?.vendor || null,
                        });
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      >
                      <option value="">-- Select Supplier --</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.vendor || "Unknown"} {partner.country ? `(${partner.country})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Add/Edit Form */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">
                    {editingMovement ? "Edit Stock Entry" : "Add New Stock Entry"}
                  </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
                      <select
                        value={formData.location}
                        onChange={(e) => {
                          const newLocation = e.target.value as "addis_ababa" | "sez_kenya" | "nairobi_partner";
                          setFormData({
                            ...formData,
                            location: newLocation,
                            // Auto-set transaction type based on location
                            transaction_type:
                              newLocation === "nairobi_partner"
                                ? "Stock Availability"
                                : formData.transaction_type === "Stock Availability"
                                ? "Purchase"
                                : formData.transaction_type,
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                        disabled={formData.transaction_type === "Stock Availability"}
                      >
                        <option value="addis_ababa">Addis Ababa</option>
                        <option value="sez_kenya">SEZ Kenya</option>
                        <option value="nairobi_partner">Nairobi Partner</option>
                      </select>
                      {formData.transaction_type === "Stock Availability" && (
                        <p className="text-xs text-slate-500 mt-1">
                          Location is automatically set to Nairobi Partner for Stock Availability
                        </p>
                      )}
                    </div>
                    {/* Supplier/Customer Selection - moved inside form */}
                    {formData.transaction_type === "Sales" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Select Customer *
                        </label>
                        <select
                          value={selectedCustomer?.customer_id || ""}
                          onChange={(e) => {
                            const customer = customers.find((c) => c.customer_id === e.target.value);
                            setSelectedCustomer(customer || null);
                            setFormData({
                              ...formData,
                              customer_id: customer?.customer_id || null,
                              customer_name: customer?.customer_name || null,
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">-- Select Customer --</option>
                          {customers.map((customer) => (
                            <option key={customer.customer_id} value={customer.customer_id}>
                              {customer.customer_name} {customer.display_id ? `(${customer.display_id})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {formData.transaction_type === "Purchase" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Select Supplier (Partner) *
                        </label>
                        <select
                          value={selectedSupplier?.id || ""}
                          onChange={(e) => {
                            const supplier = partners.find((p) => p.id === e.target.value);
                            setSelectedSupplier(supplier || null);
                            setFormData({
                              ...formData,
                              supplier_id: supplier?.id || null,
                              supplier_name: supplier?.partner || null,
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">-- Select Supplier --</option>
                          {partners.map((partner) => (
                            <option key={partner.id} value={partner.id}>
                              {partner.partner || "Unknown"} {partner.partner_country ? `(${partner.partner_country})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                      <select
                        value={formData.unit || "kg"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            unit: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="kg">kg (Kilogram)</option>
                        <option value="ton">ton (Metric Ton)</option>
                        <option value="g">g (Gram)</option>
                        <option value="lb">lb (Pound)</option>
                        <option value="oz">oz (Ounce)</option>
                        <option value="piece">piece</option>
                        <option value="unit">unit</option>
                      </select>
                    </div>
                    {formData.transaction_type !== "Stock Availability" && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Beginning Balance ({formData.unit || "kg"})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.beginning_balance}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              beginning_balance: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                    {/* Purchase fields - only show for Purchase transaction type */}
                    {formData.transaction_type === "Purchase" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Purchase ({formData.unit || "kg"}) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.purchase_kg}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFormData({
                                ...formData,
                                purchase_kg: val,
                                sold_kg: 0, // Auto-set sold to 0 when purchase is entered
                                sold_direct_shipment_kg: 0,
                              });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </>
                    )}
                    {/* Sales fields - only show for Sales transaction type */}
                    {formData.transaction_type === "Sales" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Sold ({formData.unit || "kg"}) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.sold_kg}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setFormData({
                                ...formData,
                                sold_kg: val,
                                purchase_kg: 0, // Auto-set purchase to 0 when sold is entered
                              });
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                      </>
                    )}
                    {/* Sample or Damage fields - only show for Sample or Damage transaction type */}
                    {(formData.transaction_type === "Sample" || formData.transaction_type === "Damage") && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          {formData.transaction_type === "Sample" ? "Sample" : "Damage"} ({formData.unit || "kg"}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.sample_or_damage_kg}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              sample_or_damage_kg: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    )}
                    {/* Inter-company transfer fields - only show for Inter-company transfer transaction type */}
                    {formData.transaction_type === "Inter-company transfer" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Inter Company Transfer ({formData.unit || "kg"}) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.inter_company_transfer_kg}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                inter_company_transfer_kg: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>
                        {/* Transfer destination - required for SEZ Kenya */}
                        {formData.location === "sez_kenya" && (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Transfer To Location *
                            </label>
                            <select
                              value={formData.transfer_to_location || ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  transfer_to_location: (e.target.value || null) as
                                    | "addis_ababa"
                                    | "sez_kenya"
                                    | "nairobi_partner"
                                    | null,
                                })
                              }
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="">-- Select Destination --</option>
                              <option value="addis_ababa">Addis Ababa</option>
                              <option value="sez_kenya">SEZ Kenya</option>
                              <option value="nairobi_partner">Nairobi Partner</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">
                              Select the destination location where the stock will be transferred
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {/* Stock Availability fields - only show for Stock Availability transaction type (Nairobi Partner) */}
                    {formData.transaction_type === "Stock Availability" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Stock Quantity ({formData.unit || "kg"}) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.beginning_balance}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                beginning_balance: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            required
                            placeholder="Enter available stock quantity"
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            This is for tracking stock availability at Nairobi Partner location only
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Business Model
                          </label>
                          <select
                            value={formData.business_model || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                business_model: (e.target.value || null) as "Stock" | "Direct Delivery" | null,
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Select Business Model --</option>
                            <option value="Stock">Stock</option>
                            <option value="Direct Delivery">Direct Delivery</option>
                          </select>
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Reference</label>
                      <input
                        type="text"
                        value={formData.reference || ""}
                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="PO number, invoice, etc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Remark</label>
                      <input
                        type="text"
                        value={formData.remark || ""}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Additional notes"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingMovement ? "Update" : "Create"} Stock Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setEditingMovement(null);
                        resetForm();
                      }}
                      className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
              </>
            )}

            {/* Stock History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Location Tabs */}
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

              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  {loadingMovements ? (
                    <span className="text-slate-500">Loading stock movements...</span>
                  ) : (
                    <span>{getLocationName(activeLocationTab)} Stock History ({filteredMovements.length} entries)</span>
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Customer/Partner
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        Purchase (kg)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        Sold (kg)
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        Inter-company Transfer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                        Brand
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                        Balance (kg)
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                    <tbody className="divide-y divide-slate-200">
                      {loadingMovements ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                              <p className="text-slate-500">Loading stock movements...</p>
                            </div>
                          </td>
                        </tr>
                      ) : filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                            No stock movements found for {getLocationName(activeLocationTab)}
                          </td>
                        </tr>
                      ) : (
                      filteredMovements.map((movement) => {
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
                              {movement.transaction_type === "Purchase" ? (
                                <span className="text-amber-600 font-medium">
                                  Partner: {movement.supplier_name || "—"}
                                </span>
                              ) : movement.transaction_type === "Sales" ? (
                                <span className="text-emerald-600 font-medium">
                                  Customer: {movement.customer_name || "—"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-emerald-600">
                              {movement.purchase_kg > 0 ? formatNumber(movement.purchase_kg) : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-right text-red-600">
                              {movement.sold_kg > 0 ? formatNumber(movement.sold_kg) : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold text-blue-600">
                              {movement.inter_company_transfer_kg > 0 ? (
                                <span>
                                  {formatNumber(movement.inter_company_transfer_kg)} {movement.unit || "kg"}
                                  {movement.transfer_to_location && (
                                    <span className="text-xs text-slate-500 ml-1">
                                      → {movement.transfer_to_location.replace("_", " ").toUpperCase()}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {movement.brand ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {movement.brand}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-right font-semibold">
                              {formatNumber(movement.balance_kg)} {movement.unit || "kg"}
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
        )}
      </div>
    </div>
  );
}

