import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  fetchSalesPipelineById,
  fetchSalesPipelines,
  SalesPipeline,
  PipelineStage,
  fetchChemicalTypes,
  ChemicalType,
  fetchTDS,
  fetchTDSById,
  Tds,
  api,
  CustomerListResponse,
  Customer,
  fetchPipelineVersions,
  updateSalesPipeline,
  SalesPipelineUpdate,
} from "../../services/api";
import {
  TrendingUp,
  ChevronLeft,
  X,
  Loader2,
  Edit2,
  Package,
  DollarSign,
  Calendar,
  User,
  Sparkles,
  MessageSquare,
  Send,
  ArrowRight,
  CheckCircle,
  Building2,
  FileText,
  Clock,
  Target,
  BarChart3,
  Activity,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Tag,
  Info,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRightCircle,
  Circle,
  Download,
} from "lucide-react";

// Stage colors mapping with enhanced colors
const STAGE_COLORS: Record<PipelineStage, string> = {
  Lead: "bg-slate-100 text-slate-700 border-slate-300",
  "Discovery": "bg-blue-100 text-blue-700 border-blue-300",
  "Sample": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "Validation": "bg-orange-100 text-orange-700 border-orange-300",
  "Proposal": "bg-indigo-100 text-indigo-700 border-indigo-300",
  "Confirmation": "bg-green-100 text-green-700 border-green-300",
  "Closed": "bg-emerald-500 text-white border-emerald-600",
  "Lost": "bg-red-500 text-white border-red-600",
};

// Stage progression order (sequential stages, Lost is special)
const STAGE_ORDER: PipelineStage[] = [
  "Lead",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
];

// Lost can be reached from any stage
const SEQUENTIAL_STAGES: PipelineStage[] = [
  "Lead",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
];

export function PipelineDetailPage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [selectedPipeline, setSelectedPipeline] = useState<SalesPipeline | null>(null);
  const [relatedPipelines, setRelatedPipelines] = useState<SalesPipeline[]>([]);
  const [pipelineVersions, setPipelineVersions] = useState<SalesPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data for display
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [chemicalTypes, setChemicalTypes] = useState<ChemicalType[]>([]);
  const [tdsData, setTdsData] = useState<Tds | null>(null);

  // AI Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: string }>>([]);

  // Quote generation state
  const [quoteFormat, setQuoteFormat] = useState<"Baracoda" | "Betchem">("Betchem");
  const [termsAndConditions, setTermsAndConditions] = useState<string>("");
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Update Pipeline form state
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateFormData, setUpdateFormData] = useState<{
    stage?: PipelineStage;
    amount?: number | null;
    reason_for_stage_change?: string;
    reason_for_amount_change?: string;
  }>({});
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadDropdownData() {
      try {
        const [customersRes, chemicalTypesRes] = await Promise.all([
          api.get<CustomerListResponse>("/crm/customers", { params: { limit: 500 } }),
          fetchChemicalTypes({ limit: 500 }),
        ]);
        setCustomers(customersRes.data.customers);
        setChemicalTypes(chemicalTypesRes.chemicals);
      } catch (err) {
        console.error("Failed to load dropdown data:", err);
      }
    }
    loadDropdownData();
  }, []);

  async function loadPipelineDetails() {
    if (!pipelineId) return;

    try {
      setLoading(true);
      setError(null);

      const pipeline = await fetchSalesPipelineById(pipelineId);
      setSelectedPipeline(pipeline);

      // Load TDS data if tds_id exists
      if (pipeline.tds_id) {
        try {
          const tds = await fetchTDSById(pipeline.tds_id);
          setTdsData(tds);
        } catch (err) {
          console.error("Failed to load TDS data:", err);
          setTdsData(null);
        }
      } else {
        setTdsData(null);
      }

      // Load saved AI interactions from the pipeline
      if (pipeline.ai_interactions && Array.isArray(pipeline.ai_interactions) && pipeline.ai_interactions.length > 0) {
        const savedMessages = pipeline.ai_interactions.map((interaction) => [
          { role: "user" as const, content: interaction.user_input, timestamp: interaction.timestamp },
          { role: "assistant" as const, content: interaction.ai_response, timestamp: interaction.timestamp },
        ]).flat();
        setChatMessages(savedMessages);
      }

      // Fetch ALL related pipelines for the same customer+product combination
      const productId = pipeline.chemical_type_id || pipeline.tds_id;
      if (pipeline.customer_id && productId) {
        const related = await fetchSalesPipelines({
          customer_id: pipeline.customer_id,
          chemical_type_id: pipeline.chemical_type_id || undefined,
          tds_id: pipeline.chemical_type_id ? undefined : pipeline.tds_id || undefined,
          limit: 100,
        });
        const sortedRelated = related.pipelines.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        setRelatedPipelines(sortedRelated);
      } else {
        setRelatedPipelines([pipeline]);
      }
      
      // Fetch all versions of this pipeline (history with change reasons)
      try {
        const versions = await fetchPipelineVersions(pipeline.id);
        setPipelineVersions(versions);
      } catch (err) {
        console.error("Failed to load pipeline versions:", err);
        setPipelineVersions([pipeline]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load pipeline details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipelineDetails();
  }, [pipelineId]);

  async function handleAIChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !selectedPipeline) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date().toISOString() },
    ]);

    try {
      setChatLoading(true);

      const customer = customers.find((c) => c.customer_id === selectedPipeline.customer_id);
      const product = chemicalTypes.find((ct) => ct.id === (selectedPipeline.chemical_type_id || selectedPipeline.tds_id));
      const customerName = customer?.customer_name || "this customer";
      const productName = product ? product.name : "this product";

      const response = await api.post(
        `/sales-pipeline/${selectedPipeline.id}/chat`,
        {
          input_text: userMessage,
        }
      );

      const aiResponse = response.data.response || response.data.ai_response || "I'm here to help with this pipeline. How can I assist you?";

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse, timestamp: new Date().toISOString() },
      ]);

      if (selectedPipeline) {
        const updatedPipeline = await fetchSalesPipelineById(selectedPipeline.id);
        setSelectedPipeline(updatedPipeline);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err?.response?.data?.detail ?? err?.message ?? "Failed to get AI response";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${errorMsg}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function formatCurrency(amount: number | null | undefined, currency?: string | null): string {
    if (!amount) return "—";
    const curr = currency || "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCustomerName(customerId: string): string {
    const customer = customers.find((c) => c.customer_id === customerId);
    return customer?.customer_name || customerId;
  }

  function getCustomer(customerId: string): Customer | undefined {
    return customers.find((c) => c.customer_id === customerId);
  }

  function getChemicalTypeName(chemicalTypeId: string | null | undefined): string {
    if (!chemicalTypeId) return "—";
    const chemicalType = chemicalTypes.find((ct) => ct.id === chemicalTypeId);
    return chemicalType ? chemicalType.name : chemicalTypeId;
  }

  function getBrandName(): string {
    if (tdsData?.brand) {
      return tdsData.brand + (tdsData.grade ? ` - ${tdsData.grade}` : "");
    }
    return "—";
  }

  function calculateTotalAmount(): { totalAmount: number; totalAmountWithVAT: number; quantity?: number } | null {
    if (!selectedPipeline?.amount || !selectedPipeline?.unit_price) return null;
    
    // Calculate total amount: amount * unit_price
    // Here, amount is treated as quantity, and unit_price is price per unit
    const quantity = selectedPipeline.amount;
    const totalAmount = quantity * selectedPipeline.unit_price;
    
    // Calculate VAT inclusive: total_amount * 1.15 (15% VAT added)
    const totalAmountWithVAT = totalAmount * 1.15;

    return {
      totalAmount,
      totalAmountWithVAT,
      quantity,
    };
  }

  function calculateVAT(): { withoutVAT: number; vatAmount: number; withVAT: number; quantity?: number } | null {
    const totalCalc = calculateTotalAmount();
    if (!totalCalc) return null;
    
    // Use the calculated total amount for VAT calculation
    const baseAmount = totalCalc.totalAmount;
    const vatRate = 0.15; // 15% VAT
    const vatAmount = baseAmount * vatRate;
    const withVAT = baseAmount + vatAmount;
    const withoutVAT = baseAmount;

    return {
      withoutVAT,
      vatAmount,
      withVAT,
      quantity: totalCalc.quantity,
    };
  }

  function getLatestStageReached(): PipelineStage {
    if (!pipelineVersions || pipelineVersions.length === 0) {
      return selectedPipeline?.stage || "Lead";
    }
    
    // Find the highest sequential stage ever reached in version history
    // (Lost is special and doesn't count as progress)
    let latestStage: PipelineStage = "Lead";
    let highestIndex = -1;
    
    for (const version of pipelineVersions) {
      // Skip Lost stage for progress calculation
      if (version.stage === "Lost") continue;
      
      const stageIndex = STAGE_ORDER.indexOf(version.stage);
      if (stageIndex > highestIndex) {
        highestIndex = stageIndex;
        latestStage = version.stage;
      }
    }
    
    return latestStage;
  }
  
  function isPipelineLost(): boolean {
    if (!pipelineVersions || pipelineVersions.length === 0) {
      return selectedPipeline?.stage === "Lost";
    }
    
    // Check if current version or any version is Lost
    const latestVersion = pipelineVersions.find(v => v.is_current_version) || pipelineVersions[pipelineVersions.length - 1];
    return latestVersion?.stage === "Lost" || selectedPipeline?.stage === "Lost";
  }

  function getStageProgress(): number {
    if (!selectedPipeline) return 0;
    const latestStage = getLatestStageReached();
    const currentIndex = STAGE_ORDER.indexOf(latestStage);
    return ((currentIndex + 1) / STAGE_ORDER.length) * 100;
  }

  function getDaysUntilClose(): number | null {
    if (!selectedPipeline?.expected_close_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDate = new Date(selectedPipeline.expected_close_date);
    closeDate.setHours(0, 0, 0, 0);
    const diffTime = closeDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function openQuoteModal() {
    // Set default terms and conditions based on format
    if (quoteFormat === "Betchem") {
      setTermsAndConditions("Terms and conditions:\n- For items currently in stock, the advance payment is 100 %");
    } else {
      setTermsAndConditions("Terms and conditions:\nMinium Order Quantity: 1000 KG Per Product\nPayment: Advance Payment is 50% 30% when goods are delivered at Moyale and & Balance Payment is 20% on Delivery.");
    }
    setShowQuoteModal(true);
  }

  function handleFormatChange(newFormat: "Baracoda" | "Betchem") {
    setQuoteFormat(newFormat);
    // Update terms and conditions when format changes
    if (newFormat === "Betchem") {
      setTermsAndConditions("Terms and conditions:\n- For items currently in stock, the advance payment is 100 %");
    } else {
      setTermsAndConditions("Terms and conditions:\nMinium Order Quantity: 1000 KG Per Product\nPayment: Advance Payment is 50% 30% when goods are delivered at Moyale and & Balance Payment is 20% on Delivery.");
    }
  }

  async function handleUpdatePipeline(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPipeline) return;

    const stageChanged = updateFormData.stage && updateFormData.stage !== selectedPipeline.stage;
    const amountChanged = updateFormData.amount !== undefined && updateFormData.amount !== selectedPipeline.amount;

    if (stageChanged && !updateFormData.reason_for_stage_change?.trim()) {
      alert("Reason for stage change is required when stage changes");
      return;
    }

    if (amountChanged && !updateFormData.reason_for_amount_change?.trim()) {
      alert("Reason for amount change is required when amount changes");
      return;
    }

    if (!stageChanged && !amountChanged) {
      alert("Please change either stage or amount to update the pipeline");
      return;
    }

    try {
      setUpdating(true);
      const updateData: SalesPipelineUpdate = {
        stage: updateFormData.stage,
        amount: updateFormData.amount,
        reason_for_stage_change: stageChanged ? updateFormData.reason_for_stage_change : null,
        reason_for_amount_change: amountChanged ? updateFormData.reason_for_amount_change : null,
      };

      await updateSalesPipeline(selectedPipeline.id, updateData);
      setShowUpdateForm(false);
      setUpdateFormData({});
      // Reload pipeline details to show new version
      await loadPipelineDetails();
    } catch (err: any) {
      console.error("Error updating pipeline:", err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to update pipeline");
    } finally {
      setUpdating(false);
    }
  }

  async function generateQuote() {
    if (!selectedPipeline) return;

    try {
      const customer = getCustomer(selectedPipeline.customer_id);
      const customerName = customer?.customer_name || selectedPipeline.customer_id;
      const chemicalTypeName = getChemicalTypeName(selectedPipeline.chemical_type_id || selectedPipeline.tds_id);
      const brandName = getBrandName();
      const productName = brandName !== "—" 
        ? `${chemicalTypeName} (${brandName})`
        : chemicalTypeName;
      
      const amount = selectedPipeline.amount || 0;
      const unitPrice = selectedPipeline.unit_price || 0;
      const currency = selectedPipeline.currency || "USD";
      const unit = selectedPipeline.unit || "unit";
      
      // Prepare quote request data
      const quoteRequest = {
        format: quoteFormat,
        customer_name: customerName,
        reference: `Pipeline-${selectedPipeline.id}`,
        validity: selectedPipeline.expected_close_date || undefined,
        payment_terms: null,
        delivery_terms: null,
        incoterms: null,
        notes: `Generated from Sales Pipeline - Stage: ${selectedPipeline.stage}`,
        terms_and_conditions: termsAndConditions || undefined,
        products: [
          {
            chemical_type_name: productName,
            unit: unit,
            quantity: amount, // Should be a number, not string
            target_price: unitPrice > 0 ? `${unitPrice} ${currency}` : null,
          }
        ],
        linked_customer_id: selectedPipeline.customer_id,
      };

      // Call backend API to generate Excel quote
      const response = await api.post(
        "/crm/quotes/generate",
        quoteRequest,
        {
          responseType: "blob", // Important: receive as blob for file download
        }
      );

      // Create download link
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Quote_${customerName.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Close modal after successful generation
      setShowQuoteModal(false);
    } catch (error: any) {
      console.error("Error generating quote:", error);
      alert(`Failed to generate quote: ${error?.response?.data?.detail || error?.message || "Unknown error"}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading pipeline details...</p>
        </div>
      </div>
    );
  }

  if (error || !selectedPipeline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center space-y-4">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-red-600">Error</h2>
          <p className="text-sm text-slate-600">{error || "Pipeline not found"}</p>
          <Link
            to="/sales/pipeline"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const customer = getCustomer(selectedPipeline.customer_id);
  const daysUntilClose = getDaysUntilClose();
  const stageProgress = getStageProgress();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      {/* Enhanced Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-xl">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <Link
                to="/sales/pipeline"
                className="mt-1 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400 mb-2">
                  Sales Pipeline · Detailed View
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 mb-2">
                  {getCustomerName(selectedPipeline.customer_id)}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Package className="w-4 h-4" />
                    <span className="text-sm">{getChemicalTypeName(selectedPipeline.chemical_type_id || selectedPipeline.tds_id)}</span>
                  </div>
                  {selectedPipeline.tds_id && getBrandName() !== "—" && (
                    <>
                      <span className="text-slate-500">•</span>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Tag className="w-4 h-4" />
                        <span className="text-sm">{getBrandName()}</span>
                      </div>
                    </>
                  )}
                  <span className="text-slate-500">•</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                      STAGE_COLORS[selectedPipeline.stage]
                    }`}
                  >
                    {selectedPipeline.stage}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedPipeline.stage === "Proposal" && (
                <button
                  onClick={generateQuote}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50"
                >
                  <Download className="w-4 h-4" />
                  Quote Generate
                </button>
              )}
              <button
                onClick={() => navigate(`/sales/pipeline/${selectedPipeline.id}/edit`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
              >
                <Edit2 className="w-4 h-4" />
                Edit Pipeline
              </button>
              <button
                onClick={() => {
                  setUpdateFormData({
                    stage: selectedPipeline.stage,
                    amount: selectedPipeline.amount || null,
                    reason_for_stage_change: "",
                    reason_for_amount_change: "",
                  });
                  setShowUpdateForm(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/50"
              >
                <Activity className="w-4 h-4" />
                Update Pipeline
              </button>
            </div>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Summary Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Amount Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Amount (Quantity)</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {selectedPipeline.amount 
                ? `${selectedPipeline.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedPipeline.unit || "units"}`
                : "—"}
            </p>
            {selectedPipeline.unit_price && selectedPipeline.unit && (
              <p className="text-xs text-slate-500">
                Unit Price: {formatCurrency(selectedPipeline.unit_price, selectedPipeline.currency)}/{selectedPipeline.unit}
              </p>
            )}
          </div>

          {/* Expected Close Date Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Expected Close</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {formatDate(selectedPipeline.expected_close_date || null)}
            </p>
            {daysUntilClose !== null && (
              <p className={`text-xs font-medium ${daysUntilClose < 0 ? 'text-red-600' : daysUntilClose <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>
                {daysUntilClose < 0 
                  ? `${Math.abs(daysUntilClose)} days overdue`
                  : daysUntilClose === 0
                  ? "Due today"
                  : `${daysUntilClose} days remaining`}
              </p>
            )}
          </div>

          {/* Stage Progress Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Progress</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-2">
              {Math.round(stageProgress)}%
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
          </div>

          {/* Pipeline Records Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-xs font-medium text-slate-500">Total Records</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {relatedPipelines.length}
            </p>
            <p className="text-xs text-slate-500">
              {relatedPipelines.length === 1 ? "Single pipeline" : "Related pipelines"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stage Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Pipeline Progress
              </h2>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
                
                <div className="space-y-6">
                  {(() => {
                    // Calculate these once outside the map
                    const latestStageReached = getLatestStageReached();
                    const viewingStage = selectedPipeline.stage;
                    const isLost = isPipelineLost();
                    
                    return (
                      <>
                        {STAGE_ORDER.map((stage, index) => {
                          // Marking based on latest stage reached (not viewing stage)
                          const isCompleted = STAGE_ORDER.indexOf(latestStageReached) >= index;
                          const isLatestReached = latestStageReached === stage;
                          const isViewing = viewingStage === stage;
                          const isPast = STAGE_ORDER.indexOf(latestStageReached) > index;
                          
                          // Check if this stage was changed (moved to) in version history
                          const wasChanged = (() => {
                            if (pipelineVersions.length <= 1) return false;
                            // Find if any version moved to this stage
                            for (let i = 1; i < pipelineVersions.length; i++) {
                              const version = pipelineVersions[i];
                              const prevVersion = pipelineVersions[i - 1];
                              if (version.stage === stage && prevVersion.stage !== stage && version.reason_for_stage_change) {
                                return true;
                              }
                            }
                            return false;
                          })();
                          
                          return (
                            <div key={stage} className="relative flex items-start gap-4">
                              {/* Stage indicator */}
                              <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                                isLatestReached 
                                  ? "bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-600/50" 
                                  : isCompleted
                                  ? "bg-emerald-100 border-emerald-500"
                                  : "bg-white border-slate-300"
                              }`}>
                                {isLatestReached ? (
                                  <CheckCircle2 className="w-6 h-6 text-white" />
                                ) : isCompleted ? (
                                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                                ) : (
                                  <Circle className="w-6 h-6 text-slate-400" />
                                )}
                              </div>
                              
                              {/* Stage content */}
                              <div className={`flex-1 pt-2 pb-6 ${isPast ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-3 mb-2">
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                                      STAGE_COLORS[stage]
                                    }`}
                                  >
                                    {stage}
                                  </span>
                                  {isLatestReached && (
                                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                      Latest Reached
                                    </span>
                                  )}
                                  {isViewing && !isLatestReached && (
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                      Viewing
                                    </span>
                                  )}
                                </div>
                                {wasChanged && (
                                  <div className="mt-2">
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                      CHANGED
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Lost Stage (special - can be reached from any stage) */}
                        {isLost && (
                          <div className="relative flex items-start gap-4">
                            {/* Lost indicator */}
                            <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 bg-red-500 border-red-600 shadow-lg shadow-red-500/50">
                              <XCircle className="w-6 h-6 text-white" />
                            </div>
                            
                            {/* Lost content */}
                            <div className="flex-1 pt-2 pb-6">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border bg-red-500 text-white border-red-600">
                                  Lost
                                </span>
                                {viewingStage === "Lost" && (
                                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    Viewing
                                  </span>
                                )}
                              </div>
                              {/* Check if Lost was changed to */}
                              {(() => {
                                if (pipelineVersions.length <= 1) return null;
                                for (let i = 1; i < pipelineVersions.length; i++) {
                                  const version = pipelineVersions[i];
                                  const prevVersion = pipelineVersions[i - 1];
                                  if (version.stage === "Lost" && prevVersion.stage !== "Lost" && version.reason_for_stage_change) {
                                    return (
                                      <div className="mt-2">
                                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                          CHANGED
                                        </span>
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Current Pipeline Details */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-emerald-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Pipeline Details
                </h2>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Current Record
                </span>
              </div>

              <div className="space-y-6">
                {/* Customer Information */}
                {customer && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Customer Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Customer Name</label>
                        <p className="text-slate-900 font-semibold">{customer.customer_name}</p>
                        {customer.display_id && (
                          <p className="text-xs text-slate-500 mt-1">ID: {customer.display_id}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Product Information */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Product Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Chemical Type</label>
                      <p className="text-slate-900 font-semibold">
                        {getChemicalTypeName(selectedPipeline.chemical_type_id || selectedPipeline.tds_id)}
                      </p>
                    </div>
                    {selectedPipeline.tds_id && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Vendor (TDS)</label>
                        <p className="text-slate-900 font-semibold">
                          {getBrandName()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deal Information */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Deal Information
                    </h3>
                    {selectedPipeline.stage === "Proposal" && (
                      <button
                        onClick={openQuoteModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
                      >
                        <Download className="w-4 h-4" />
                        Quote Generate
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-lg border border-emerald-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Amount (Quantity)</label>
                      <p className="text-2xl font-bold text-slate-900">
                        {selectedPipeline.amount 
                          ? `${selectedPipeline.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${selectedPipeline.unit || "units"}`
                          : "—"}
                      </p>
                      {selectedPipeline.unit_price && (
                        <p className="text-xs text-slate-500 mt-1">
                          Unit Price: {formatCurrency(selectedPipeline.unit_price, selectedPipeline.currency)}/{selectedPipeline.unit || "unit"}
                        </p>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Expected Close Date</label>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatDate(selectedPipeline.expected_close_date || null)}
                      </p>
                      {daysUntilClose !== null && (
                        <p className={`text-xs font-medium mt-1 ${daysUntilClose < 0 ? 'text-red-600' : daysUntilClose <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>
                          {daysUntilClose < 0 
                            ? `${Math.abs(daysUntilClose)} days overdue`
                            : daysUntilClose === 0
                            ? "Due today"
                            : `${daysUntilClose} days remaining`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total Amount Calculation */}
                {calculateTotalAmount() && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Total Amount Calculation
                    </h3>
                    <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                          <span className="text-sm font-medium text-slate-700">Quantity (Amount)</span>
                          <span className="text-lg font-bold text-slate-900">
                            {calculateTotalAmount()!.quantity?.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedPipeline.unit || "units"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                          <span className="text-sm font-medium text-slate-700">Unit Price</span>
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrency(selectedPipeline.unit_price || 0, selectedPipeline.currency)}/{selectedPipeline.unit || "unit"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                          <span className="text-sm font-medium text-slate-700">Total Amount</span>
                          <span className="text-lg font-bold text-slate-900">
                            {formatCurrency(calculateTotalAmount()!.totalAmount, selectedPipeline.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 bg-blue-100/50 rounded-lg p-3">
                          <span className="text-base font-bold text-slate-900">Total Amount (VAT Inclusive)</span>
                          <span className="text-2xl font-bold text-blue-700">
                            {formatCurrency(calculateTotalAmount()!.totalAmountWithVAT, selectedPipeline.currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Business Details */}
                {(selectedPipeline.business_model || selectedPipeline.unit || selectedPipeline.unit_price || selectedPipeline.forex || selectedPipeline.business_unit || selectedPipeline.incoterm) && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Business Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {selectedPipeline.business_model && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Business Model</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.business_model}</p>
                        </div>
                      )}
                      {selectedPipeline.unit && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Unit</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.unit}</p>
                        </div>
                      )}
                      {selectedPipeline.unit_price && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Unit Price</label>
                          <p className="text-slate-900 font-semibold">
                            {formatCurrency(selectedPipeline.unit_price, selectedPipeline.currency)}/{selectedPipeline.unit || "unit"}
                          </p>
                          {selectedPipeline.currency && (
                            <p className="text-xs text-slate-500 mt-1">Currency: {selectedPipeline.currency}</p>
                          )}
                        </div>
                      )}
                      {selectedPipeline.forex && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Forex (Currency Risk)</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.forex}</p>
                          {selectedPipeline.forex === "LeanChems" && (
                            <p className="text-xs text-slate-500 mt-1">ETB transactions, LeanChems manages forex</p>
                          )}
                          {selectedPipeline.forex === "Client" && (
                            <p className="text-xs text-slate-500 mt-1">Foreign currency, client bears risk</p>
                          )}
                        </div>
                      )}
                      {selectedPipeline.business_unit && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Business Unit</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.business_unit}</p>
                          {(selectedPipeline.business_unit === "Hayat" || 
                            selectedPipeline.business_unit === "Alhadi" || 
                            selectedPipeline.business_unit === "Bet-chem" || 
                            selectedPipeline.business_unit === "Barracoda") && (
                            <p className="text-xs text-slate-500 mt-1">Import of Record contracts, Stock sales</p>
                          )}
                          {selectedPipeline.business_unit === "Nyumb-Chem" && (
                            <p className="text-xs text-slate-500 mt-1">Agency models, Direct Import</p>
                          )}
                        </div>
                      )}
                      {selectedPipeline.incoterm && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Incoterm</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.incoterm}</p>
                          {selectedPipeline.incoterm === "Import of Record" && (
                            <p className="text-xs text-slate-500 mt-1">We act as official importer</p>
                          )}
                          {selectedPipeline.incoterm === "Agency" && (
                            <p className="text-xs text-slate-500 mt-1">We act as intermediary</p>
                          )}
                          {selectedPipeline.incoterm === "Direct Import" && (
                            <p className="text-xs text-slate-500 mt-1">Client handles import</p>
                          )}
                          {selectedPipeline.incoterm === "Stock – Addis Ababa" && (
                            <p className="text-xs text-slate-500 mt-1">Sell from local warehouse</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}


                {/* Lead Information */}
                {(selectedPipeline.lead_source || selectedPipeline.contact_per_lead) && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Lead Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedPipeline.lead_source && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Lead Source</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.lead_source}</p>
                        </div>
                      )}
                      {selectedPipeline.contact_per_lead && (
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <label className="text-xs font-medium text-slate-500 mb-1 block">Contact Person</label>
                          <p className="text-slate-900 font-semibold">{selectedPipeline.contact_per_lead}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Created</label>
                      <p className="text-slate-900 font-semibold">
                        {formatDateTime(selectedPipeline.created_at || null)}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Last Updated</label>
                      <p className="text-slate-900 font-semibold">
                        {formatDateTime(selectedPipeline.updated_at || null)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Close Reason */}
                {selectedPipeline.close_reason && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Close Information
                    </h3>
                    <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                      <label className="text-xs font-medium text-red-700 mb-2 block">Close Reason</label>
                      <p className="text-slate-900">{selectedPipeline.close_reason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Full Version History (Collapsible) */}
            {pipelineVersions.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-600" />
                  Full Version History
                  <span className="text-sm font-normal text-slate-500">({pipelineVersions.length} versions)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pipelineVersions.map((version, index) => {
                    const prevVersion = index > 0 ? pipelineVersions[index - 1] : null;
                    const stageChanged = prevVersion && prevVersion.stage !== version.stage;
                    const amountChanged = prevVersion && prevVersion.amount !== version.amount;
                    
                    return (
                      <div
                        key={version.id}
                        className={`p-5 rounded-xl border-2 transition-all cursor-pointer hover:shadow-lg ${
                          version.id === selectedPipeline.id
                            ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-400 shadow-lg"
                            : version.is_current_version
                            ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                        onClick={() => navigate(`/sales/pipeline/${version.id}`)}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                V{version.version_number || index + 1}
                              </span>
                              {version.is_current_version && (
                                <span className="text-xs px-2 py-1 rounded-full bg-emerald-600 text-white font-semibold">
                                  Current
                                </span>
                              )}
                              {version.id === selectedPipeline.id && (
                                <span className="text-xs px-2 py-1 rounded-full bg-blue-600 text-white font-semibold">
                                  Viewing
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Stage Badge - Prominent */}
                        <div className="mb-4">
                          <span
                            className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border-2 ${
                              STAGE_COLORS[version.stage]
                            }`}
                          >
                            {version.stage}
                          </span>
                          {stageChanged && prevVersion && (
                            <p className="text-xs text-slate-500 mt-2">
                              <span className="font-semibold">From:</span> {prevVersion.stage}
                            </p>
                          )}
                        </div>
                        
                        {/* Amount */}
                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-1">Amount</p>
                          <p className="text-lg font-bold text-slate-900">
                            {version.amount 
                              ? `${version.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${version.unit || "units"}`
                              : "—"}
                          </p>
                          {amountChanged && prevVersion && (
                            <p className="text-xs text-slate-500 mt-1">
                              <span className="font-semibold">From:</span> {prevVersion.amount 
                                ? `${prevVersion.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${prevVersion.unit || "units"}`
                                : "—"}
                            </p>
                          )}
                        </div>
                        
                        {/* Change Reasons - Prominently Displayed */}
                        {(version.reason_for_stage_change || version.reason_for_amount_change) && (
                          <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300">
                            <p className="text-xs font-bold text-blue-900 mb-2 uppercase tracking-wide">Change Reason:</p>
                            {version.reason_for_stage_change && (
                              <div className="mb-2">
                                <p className="text-xs font-semibold text-blue-800 mb-1">Stage Change:</p>
                                <p className="text-sm text-blue-900 font-medium leading-relaxed">{version.reason_for_stage_change}</p>
                              </div>
                            )}
                            {version.reason_for_amount_change && (
                              <div>
                                <p className="text-xs font-semibold text-blue-800 mb-1">Amount Change:</p>
                                <p className="text-sm text-blue-900 font-medium leading-relaxed">{version.reason_for_amount_change}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Timestamp */}
                        <div className="pt-3 border-t border-slate-200">
                          <p className="text-xs text-slate-400">
                            {formatDateTime(version.created_at || null)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>

          {/* Right Column - AI Assistant */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  AI Assistant
                </h2>
                <span className="inline-flex items-center rounded-full bg-purple-500/10 px-3 py-1 text-[11px] font-medium text-purple-700 border border-purple-500/30">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-4">
                Get AI-powered insights about this pipeline. Ask about next steps, pricing strategies, or customer insights.
              </p>

              {/* Chat Messages */}
              <div className="space-y-3 mb-4 max-h-[500px] overflow-y-auto pr-2">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-xs">Start a conversation to get AI advice</p>
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 shadow-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white"
                            : "bg-slate-100 text-slate-900 border border-slate-200"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        <p className={`text-xs mt-2 ${msg.role === "user" ? "text-emerald-100" : "text-slate-500"}`}>
                          {formatDateTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-lg p-3 border border-slate-200">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleAIChat} className="space-y-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about next steps, pricing, product fit..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 resize-y"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {chatLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Update Pipeline Modal */}
      {showUpdateForm && selectedPipeline && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Update Pipeline
                </h2>
                <button
                  onClick={() => {
                    setShowUpdateForm(false);
                    setUpdateFormData({});
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                Update the stage or amount. A new version will be created with your change reasons.
              </p>
            </div>
            <form onSubmit={handleUpdatePipeline} className="p-6 space-y-6">
              {/* Current Stage Display */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Current Stage</p>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${
                    STAGE_COLORS[selectedPipeline.stage]
                  }`}
                >
                  {selectedPipeline.stage}
                </span>
              </div>

              {/* Stage Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Stage <span className="text-red-500">*</span>
                </label>
                <select
                  value={updateFormData.stage || selectedPipeline.stage}
                  onChange={(e) =>
                    setUpdateFormData({
                      ...updateFormData,
                      stage: e.target.value as PipelineStage,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {/* Show current stage */}
                  <option value={selectedPipeline.stage}>
                    {selectedPipeline.stage} (Current)
                  </option>
                  {/* Show next sequential stage if not Lost or Closed */}
                  {(() => {
                    const currentIndex = SEQUENTIAL_STAGES.indexOf(selectedPipeline.stage);
                    const availableStages: PipelineStage[] = [];
                    
                    // If current stage is in sequential order, show next stage
                    if (currentIndex >= 0 && currentIndex < SEQUENTIAL_STAGES.length - 1) {
                      availableStages.push(SEQUENTIAL_STAGES[currentIndex + 1]);
                    }
                    
                    // Always allow Lost (can be reached from any stage)
                    availableStages.push("Lost");
                    
                    return availableStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                        {stage === SEQUENTIAL_STAGES[currentIndex + 1] && " (Next Sequential)"}
                        {stage === "Lost" && " (Can jump from any stage)"}
                      </option>
                    ));
                  })()}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  You can only move to the next sequential stage or mark as Lost. Sequential progression: {SEQUENTIAL_STAGES.join(" → ")}
                </p>
                {updateFormData.stage && updateFormData.stage !== selectedPipeline.stage && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reason for Stage Change <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={updateFormData.reason_for_stage_change || ""}
                      onChange={(e) =>
                        setUpdateFormData({
                          ...updateFormData,
                          reason_for_stage_change: e.target.value,
                        })
                      }
                      required
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Explain why the stage is changing..."
                    />
                  </div>
                )}
              </div>

              {/* Current Amount Display */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Current Amount</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedPipeline.amount 
                    ? `${selectedPipeline.amount.toLocaleString()} ${selectedPipeline.unit || "units"}`
                    : "—"}
                </p>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  New Amount (Quantity)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={updateFormData.amount !== undefined ? (updateFormData.amount || "") : (selectedPipeline.amount || "")}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUpdateFormData({
                      ...updateFormData,
                      amount: value && value !== "" ? parseFloat(value) : null,
                    });
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter new amount..."
                />
                {updateFormData.amount !== undefined && updateFormData.amount !== selectedPipeline.amount && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Reason for Amount Change <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={updateFormData.reason_for_amount_change || ""}
                      onChange={(e) =>
                        setUpdateFormData({
                          ...updateFormData,
                          reason_for_amount_change: e.target.value,
                        })
                      }
                      required
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Explain why the amount is changing..."
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowUpdateForm(false);
                    setUpdateFormData({});
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Update Pipeline
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quote Generation Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Generate Quote
                </h2>
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Quote Format
                </label>
                <select
                  value={quoteFormat}
                  onChange={(e) => handleFormatChange(e.target.value as "Baracoda" | "Betchem")}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Betchem">Betchem</option>
                  <option value="Baracoda">Baracoda</option>
                </select>
              </div>

              {/* Terms and Conditions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Terms and Conditions
                </label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  placeholder="Enter terms and conditions..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  {quoteFormat === "Betchem" 
                    ? "This will be written to cell A16 in the Excel file."
                    : "This will be written to cell B34 in the Excel file."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => setShowQuoteModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateQuote}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  Generate & Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
