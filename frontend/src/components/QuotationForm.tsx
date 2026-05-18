import { useState, useEffect } from "react";
import { fetchTDS, Tds, fetchChemicalTypes, ChemicalType, fetchCustomers, Customer, fetchPartnerChemicals, PartnerChemical } from "../services/api";
import { X, Plus, Trash2, FileText, Download, Eye } from "lucide-react";

export interface QuotationProduct {
  id: string;
  chemical_type_id: string | null;
  product_name: string; // Chemical type name
  tds_id: string | null;
  vendor_name: string; // Vendor name (changed from brand_name)
  unit_price: number | null;
  quantity: number | null;
  amount: number; // Calculated: unit_price * quantity
}

export type QuotationFormType = "Baracoda" | "Nyumb-Chem" | "Bet-chem";

export interface QuotationFormData {
  form_type: QuotationFormType;
  products: QuotationProduct[];
  payment_terms: string;
  total_amount: number;
}

interface QuotationFormProps {
  pipelineId?: string;
  customerId?: string;
  pipelineData?: {
    product_name?: string | null;
    chemical_type_id?: string | null;
    vendor_name?: string | null;
    unit_price?: number | null;
    unit?: string | null;
  } | null;
  onSave?: (data: QuotationFormData) => void;
  onCancel?: () => void;
  initialData?: QuotationFormData;
  defaultFormType?: QuotationFormType;
}

const PAYMENT_TERMS_OPTIONS = [
  {
    value: "option1",
    label: "Option 1: 50% Advance + 50% on Delivery",
    description: "Fifty percent (50%) advance upon signing of the contract\nFifty percent (50%) upon final delivery",
  },
  {
    value: "option2",
    label: "Option 2: 50% Advance + 30% at Dry Port + 20% on Delivery",
    description: "Fifty percent (50%) advance upon signing of the contract\nThirty percent (30%) upon arrival of goods at the dry port\nTwenty percent (20%) upon final delivery",
  },
  {
    value: "option3",
    label: "Option 3: 60% Advance + 40% on Delivery",
    description: "Sixty percent (60%) advance upon signing of the contract\nForty percent (40%) upon final delivery",
  },
  {
    value: "option4",
    label: "Option 4: 30% Advance + 40% at Dry Port + 30% on Delivery",
    description: "Thirty percent (30%) advance upon signing of the contract\nForty percent (40%) upon arrival of goods at the dry port\nThirty percent (30%) upon final delivery",
  },
  {
    value: "option5",
    label: "Option 5: 50% Advance + 25% at Dry Port + 25% on Delivery",
    description: "Fifty percent (50%) advance upon signing of the contract\nTwenty-five percent (25%) upon arrival of goods at the dry port\nTwenty-five percent (25%) upon final delivery",
  },
];

export function QuotationForm({ pipelineId, customerId, pipelineData, onSave, onCancel, initialData, defaultFormType = "Baracoda" }: QuotationFormProps) {
  const [formType, setFormType] = useState<QuotationFormType>(initialData?.form_type || defaultFormType);
  const [chemicalTypes, setChemicalTypes] = useState<ChemicalType[]>([]);
  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [partnerChemicals, setPartnerChemicals] = useState<PartnerChemical[]>([]);
  const [loadingTds, setLoadingTds] = useState(false);
  const [loadingChemicalTypes, setLoadingChemicalTypes] = useState(false);
  const [loadingPartnerChemicals, setLoadingPartnerChemicals] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [products, setProducts] = useState<QuotationProduct[]>(
    initialData?.products || []
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(initialData?.payment_terms || "");

  // Load Chemical Types
  useEffect(() => {
    async function loadChemicalTypes() {
      try {
        setLoadingChemicalTypes(true);
        const res = await fetchChemicalTypes({ limit: 1000 });
        setChemicalTypes(res.chemicals || []);
      } catch (err) {
        console.error("Failed to load chemical types:", err);
      } finally {
        setLoadingChemicalTypes(false);
      }
    }
    loadChemicalTypes();
  }, []);

  // Load Partner Chemicals (for vendor list)
  useEffect(() => {
    async function loadPartnerChemicals() {
      try {
        setLoadingPartnerChemicals(true);
        const res = await fetchPartnerChemicals({ limit: 1000 });
        setPartnerChemicals(res.partner_chemicals || []);
      } catch (err) {
        console.error("Failed to load partner chemicals:", err);
      } finally {
        setLoadingPartnerChemicals(false);
      }
    }
    loadPartnerChemicals();
  }, []);

  // Load customer name if customerId is provided
  useEffect(() => {
    async function loadCustomerName() {
      if (customerId) {
        try {
          const res = await fetchCustomers({ limit: 1000 });
          const customer = res.customers.find((c: Customer) => c.customer_id === customerId);
          if (customer) {
            setCompanyName(customer.customer_name);
          }
        } catch (err) {
          console.error("Failed to load customer name:", err);
        }
      }
    }
    loadCustomerName();
  }, [customerId]);

  // Auto-fill form from pipeline data when pipelineData is provided
  useEffect(() => {
    if (pipelineData && products.length === 0 && !initialData && chemicalTypes.length > 0) {
      const productName = pipelineData.product_name || "";
      const chemicalTypeId = pipelineData.chemical_type_id || null;
      const vendorName = pipelineData.vendor_name || "";
      const unitPrice = pipelineData.unit_price || null;
      const quantity = pipelineData.unit ? parseFloat(pipelineData.unit) : null;

      // Find matching chemical type
      const matchingChemicalType = chemicalTypes.find(
        (ct) => ct.id === chemicalTypeId || ct.name === productName
      );

      // Find vendor from partner_chemicals
      let finalVendorName = vendorName;
      if (vendorName && partnerChemicals.length > 0) {
        const matchingVendor = partnerChemicals.find(
          (pc) => pc.vendor?.toLowerCase() === vendorName.toLowerCase()
        );
        if (matchingVendor) {
          finalVendorName = matchingVendor.vendor;
        }
      }

      if (matchingChemicalType || productName) {
        const newProduct: QuotationProduct = {
          id: Date.now().toString(),
          chemical_type_id: matchingChemicalType?.id || chemicalTypeId,
          product_name: matchingChemicalType?.name || productName,
          tds_id: null,
          vendor_name: finalVendorName, // Auto-filled from pipeline
          unit_price: unitPrice, // Auto-filled from pipeline
          quantity: quantity, // Auto-filled from pipeline
          amount: unitPrice && quantity ? unitPrice * quantity : 0, // Auto-calculated
        };
        setProducts([newProduct]);
      }
    }
  }, [pipelineData, chemicalTypes, partnerChemicals, products.length, initialData]);

  // Load TDS data when chemical type is selected
  async function loadTDSForChemicalType(chemicalTypeId: string) {
    try {
      setLoadingTds(true);
      const res = await fetchTDS({ chemical_type_id: chemicalTypeId, limit: 1000 });
      setTdsList(res.tds || []);
    } catch (err) {
      console.error("Failed to load TDS:", err);
      setTdsList([]);
    } finally {
      setLoadingTds(false);
    }
  }

  // Get available vendors from partner_chemicals
  function getAvailableVendors(): string[] {
    const vendorSet = new Set<string>();
    partnerChemicals.forEach((pc) => {
      if (pc.vendor) {
        vendorSet.add(pc.vendor);
      }
    });
    return Array.from(vendorSet).sort();
  }

  // Add new product row
  function handleAddProduct() {
    const newId = Date.now().toString();
    setProducts([
      ...products,
      {
        id: newId,
        chemical_type_id: null,
        product_name: "",
        tds_id: null,
        vendor_name: "",
        unit_price: null,
        quantity: null,
        amount: 0,
      },
    ]);
  }

  // Remove product row
  function handleRemoveProduct(productId: string) {
    setProducts(products.filter((p) => p.id !== productId));
  }

  // Update product chemical type selection
  async function handleProductChemicalTypeChange(productId: string, chemicalTypeId: string) {
    const chemicalType = chemicalTypes.find((ct) => ct.id === chemicalTypeId);
    const productName = chemicalType?.name || "";

    // Load TDS for this chemical type
    await loadTDSForChemicalType(chemicalTypeId);

    setProducts(
      products.map((p) =>
        p.id === productId
          ? {
              ...p,
              chemical_type_id: chemicalTypeId,
              product_name: productName,
              tds_id: null, // Reset vendor selection
              vendor_name: "",
            }
          : p
      )
    );
  }

  // Update vendor name from partner_chemicals dropdown
  function handleVendorChange(productId: string, vendorName: string) {
    setProducts(
      products.map((p) =>
        p.id === productId
          ? {
              ...p,
              vendor_name: vendorName,
            }
          : p
      )
    );
  }

  // Update unit price
  function handleUnitPriceChange(productId: string, value: string) {
    const numValue = value === "" ? null : parseFloat(value);
    setProducts(
      products.map((p) => {
        if (p.id === productId) {
          const newUnitPrice = numValue;
          const newAmount = newUnitPrice && p.quantity ? newUnitPrice * p.quantity : 0;
          return {
            ...p,
            unit_price: newUnitPrice,
            amount: newAmount,
          };
        }
        return p;
      })
    );
  }

  // Update quantity
  function handleQuantityChange(productId: string, value: string) {
    const numValue = value === "" ? null : parseFloat(value);
    setProducts(
      products.map((p) => {
        if (p.id === productId) {
          const newQuantity = numValue;
          const newAmount = p.unit_price && newQuantity ? p.unit_price * newQuantity : 0;
          return {
            ...p,
            quantity: newQuantity,
            amount: newAmount,
          };
        }
        return p;
      })
    );
  }

  // Calculate total amount
  const totalAmount = products.reduce((sum, p) => sum + p.amount, 0);

  // Handle save
  function handleSave() {
    if (products.length === 0) {
      alert("Please add at least one product");
      return;
    }
    if (products.some((p) => !p.chemical_type_id || !p.product_name)) {
      alert("Please select a product name for all rows");
      return;
    }
    if (products.some((p) => !p.vendor_name)) {
      alert("Please enter a vendor name for all products");
      return;
    }
    if (products.some((p) => p.unit_price === null || p.quantity === null)) {
      alert("Please enter unit price and quantity for all products");
      return;
    }
    if (!paymentTerms) {
      alert("Please select payment terms");
      return;
    }

    const formData: QuotationFormData = {
      form_type: formType,
      products,
      payment_terms: paymentTerms,
      total_amount: totalAmount,
    };

    if (onSave) {
      onSave(formData);
    }
  }

  // Export to Excel - using backend service to preserve template formatting
  async function handleExportToExcel() {
    if (products.length === 0) {
      alert("Please add products to the quotation before exporting");
      return;
    }

    // Validate products before export
    const validProducts = products.filter((p) => p.product_name && p.vendor_name && p.unit_price && p.quantity);
    if (validProducts.length === 0) {
      alert("Please ensure all products have product name, vendor, unit price, and quantity");
      return;
    }

    if (!paymentTerms) {
      alert("Please select payment terms before exporting");
      return;
    }

    try {
      // Prepare request data
      const quotationData = {
        form_type: formType,
        products: validProducts.map((p) => ({
          product_name: p.product_name,
          vendor_name: p.vendor_name,
          unit_price: p.unit_price || 0,
          quantity: p.quantity || 0,
        })),
        payment_option: paymentTerms ? parseInt(paymentTerms.replace("option", "")) : 1,
        company_name: companyName || undefined,
      };

      console.log("Exporting quotation with data:", quotationData);

      // Call backend API
      const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
      const response = await fetch(`${apiBaseUrl}/pms/generate-quotation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quotationData),
      });

      if (!response.ok) {
        let errorMessage = "Failed to generate quotation";
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        console.error("Quotation generation failed:", errorMessage);
        throw new Error(errorMessage);
      }

      // Get filename from response headers or generate one
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `Quotation_${formType}_${new Date().toISOString().split("T")[0]}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      // Download the file
      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Generated file is empty");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      console.log("Quotation downloaded successfully:", filename);
    } catch (err: any) {
      console.error("Error exporting to Excel:", err);
      alert(err.message || "Failed to export quotation. Please check the console for details and try again.");
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-white w-full p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Create Quotation</h2>
                  <p className="text-sm text-slate-500 mt-1">Generate professional quotations for your clients</p>
                </div>
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Form Type Selection */}
          <div className="p-6 border-b border-slate-200">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Quotation Form Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(["Baracoda", "Nyumb-Chem", "Bet-chem"] as QuotationFormType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFormType(type)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formType === type
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Products</h3>
                <p className="text-sm text-slate-500 mt-1">Add products to your quotation</p>
              </div>
              <button
                onClick={handleAddProduct}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Product
              </button>
            </div>
          </div>

          {/* Products List - Better Layout */}
          <div className="p-6">
            {products.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-semibold text-slate-900">Start with an empty quotation</p>
                <p className="mt-1 text-sm text-slate-600">
                  Click <span className="font-medium">Add Product</span> to begin.
                </p>
              </div>
            ) : null}

            <div className="space-y-4">
              {products.map((product, index) => {
                const availableVendors = getAvailableVendors();
                return (
                  <div
                    key={product.id}
                    className="border-2 border-slate-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition-all bg-slate-50/50"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
                          {index + 1}
                        </div>
                        <h4 className="font-semibold text-slate-900">Product #{index + 1}</h4>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove product"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Product Name */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Product Name <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={product.chemical_type_id || ""}
                          onChange={(e) => handleProductChemicalTypeChange(product.id, e.target.value)}
                          className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                          disabled={loadingChemicalTypes}
                        >
                          <option value="">Select Product Name...</option>
                          {chemicalTypes.map((ct) => (
                            <option key={ct.id} value={ct.id}>
                              {ct.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Vendor - Auto-filled from pipeline, editable from partner_chemicals */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Vendor <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={product.vendor_name || ""}
                          onChange={(e) => handleVendorChange(product.id, e.target.value)}
                          className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                          disabled={loadingPartnerChemicals}
                          required
                        >
                          <option value="">
                            {loadingPartnerChemicals
                              ? "Loading vendors..."
                              : availableVendors.length === 0
                              ? "No vendors available"
                              : "Select Vendor..."}
                          </option>
                          {availableVendors.map((vendor) => (
                            <option key={vendor} value={vendor}>
                              {vendor}
                            </option>
                          ))}
                        </select>
                        {product.vendor_name && (
                          <p className="text-xs text-slate-500 mt-1">
                            Auto-filled from pipeline • Editable
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Unit Price */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Unit Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={product.unit_price ?? ""}
                            onChange={(e) => handleUnitPriceChange(product.id, e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border-2 border-slate-300 bg-white pl-8 pr-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                          />
                        </div>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={product.quantity ?? ""}
                          onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Amount</label>
                        <div className="w-full rounded-lg border-2 border-emerald-200 bg-emerald-50 px-4 py-2.5">
                          <span className="text-lg font-bold text-emerald-700">
                            ${product.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Summary */}
            <div className="mt-6 pt-6 border-t-2 border-slate-200">
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200">
                <span className="text-lg font-bold text-slate-900">TOTAL AMOUNT:</span>
                <span className="text-2xl font-bold text-emerald-700">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6">
          <div className="p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Payment Terms <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium"
            >
              <option value="">Select Payment Terms...</option>
              {PAYMENT_TERMS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {paymentTerms && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {PAYMENT_TERMS_OPTIONS.find((o) => o.value === paymentTerms)?.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all"
            >
              <Eye className="w-5 h-5" />
              {showPreview ? "Hide Preview" : "Preview Quotation"}
            </button>
            <div className="flex gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-6 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleExportToExcel}
                disabled={products.length === 0 || totalAmount === 0}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                <Download className="w-5 h-5" />
                Download Excel
              </button>
              {onSave && (
                <button
                  onClick={handleSave}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:shadow-lg transition-all"
                >
                  Save Quotation
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-6">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Quotation Preview</h3>
              <p className="text-sm text-slate-500 mt-1">Review your quotation before downloading</p>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 rounded-xl">
                <span className="text-sm font-medium text-slate-600">Form Type: </span>
                <span className="text-sm font-bold text-emerald-700">{formType}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Product Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Vendor</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {products
                      .filter((p) => p.product_name && p.vendor_name)
                      .map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-900">{product.product_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{product.vendor_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right">${product.unit_price?.toFixed(2) || "0.00"}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right">{product.quantity || "0"}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">${product.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-gradient-to-r from-emerald-50 to-teal-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-right text-sm font-bold text-slate-700">
                        TOTAL:
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-emerald-700 text-right">${totalAmount.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {paymentTerms && (
                <div className="mt-6 pt-6 border-t-2 border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Payment Terms:</h4>
                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {PAYMENT_TERMS_OPTIONS.find((o) => o.value === paymentTerms)?.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

