import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams, useNavigate, useParams } from "react-router-dom";
import {
  fetchSalesPipelines,
  fetchSalesPipelineById,
  createSalesPipeline,
  updateSalesPipeline,
  deleteSalesPipeline,
  SalesPipeline,
  SalesPipelineCreate,
  SalesPipelineUpdate,
  PipelineStage,
  Currency,
  fetchChemicalTypes,
  fetchTDS,
  Customer,
  ChemicalType,
  Tds,
  api,
  CustomerListResponse,
  fetchBusinessModels,
  fetchCurrencies,
  fetchVendors,
  fetchChemicalFullData,
  ChemicalFullData,
  fetchPartnerChemicals,
} from "../../services/api";
import {
  TrendingUp,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Edit2,
  Trash2,
  DollarSign,
  Calendar,
  User,
  Package,
  AlertCircle,
  CheckCircle,
  X,
  Activity,
  FileText,
  Folder,
  ChevronDown,
} from "lucide-react";
import { QuotationForm, QuotationFormData, QuotationFormType } from "../../components/QuotationForm";

// Stage colors mapping
const STAGE_COLORS: Record<PipelineStage, string> = {
  "Lead ID": "bg-slate-100 text-slate-700 border-slate-300",
  "Discovery": "bg-blue-100 text-blue-700 border-blue-300",
  "Sample": "bg-yellow-100 text-yellow-700 border-yellow-300",
  "Validation": "bg-orange-100 text-orange-700 border-orange-300",
  "Proposal": "bg-indigo-100 text-indigo-700 border-indigo-300",
  "Confirmation": "bg-green-100 text-green-700 border-green-300",
  "Closed": "bg-emerald-500 text-white border-emerald-600",
  "Lost": "bg-red-500 text-white border-red-600",
};

const PIPELINE_STAGES: PipelineStage[] = [
  "Lead ID",
  "Discovery",
  "Sample",
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
  "Lost",
];

// Stages that require business_model, unit, and unit_price
const STAGES_REQUIRING_BUSINESS_DETAILS: PipelineStage[] = [
  "Validation",
  "Proposal",
  "Confirmation",
  "Closed",
];

export function SalesPipelinePage() {
  const { pipelineId: urlPipelineId } = useParams<{ pipelineId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Debug: Log when component mounts or pipelineId changes
  useEffect(() => {
    console.log("SalesPipelinePage mounted/updated:", { 
      urlPipelineId, 
      pathname: window.location.pathname,
      isEditRoute: window.location.pathname.includes("/edit")
    });
  }, [urlPipelineId]);
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filters - initialize from URL params
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    searchParams.get("customer") || ""
  );
  const [selectedChemicalType, setSelectedChemicalType] = useState<string>(
    searchParams.get("chemical_type") || ""
  );
  const [selectedStage, setSelectedStage] = useState<PipelineStage | "">(
    (searchParams.get("stage") as PipelineStage) || ""
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Data for dropdowns
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [chemicalTypes, setChemicalTypes] = useState<ChemicalType[]>([]);
  const [chemicalFullData, setChemicalFullData] = useState<ChemicalFullData[]>([]);
  const [tdsList, setTdsList] = useState<Tds[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [partnerChemicals, setPartnerChemicals] = useState<any[]>([]);
  const [businessModels, setBusinessModels] = useState<string[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Create/Edit form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<SalesPipeline | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formData, setFormData] = useState<SalesPipelineCreate>({
    customer_id: "",
    tds_id: null,
    // We no longer link directly to chemical_types; let backend treat this as null
    chemical_type_id: null,
    // New pipelines must always start as Lead ID (matches backend PIPELINE_STAGES)
    stage: "Lead ID",
    amount: null,
    currency: null,
    expected_close_date: null,
    close_reason: null,
    lead_source: null,
    contact_per_lead: null,
    business_model: null,
    unit: null,
    unit_price: null,
    metadata: null,
  });
  const [reasonForStageChange, setReasonForStageChange] = useState("");
  const [reasonForAmountChange, setReasonForAmountChange] = useState("");


  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  // Quotation form state
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [quotationPipelineId, setQuotationPipelineId] = useState<string | null>(null);

  // Ref to track if we've already processed edit params (prevent infinite loops)
  const editProcessedRef = useRef<string | null>(null);

  // Grouped view: which customers (companies) are expanded
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  // Load customers, Chemical Types, business models, and currencies for dropdowns
  useEffect(() => {
    async function loadDropdownData() {
      try {
        const [customersRes, chemicalTypesRes, chemicalFullDataRes, businessModelsRes, currenciesRes, vendorsRes, partnerChemicalsRes] = await Promise.all([
          api.get<CustomerListResponse>("/crm/customers", { params: { limit: 500 } }),
          fetchChemicalTypes({ limit: 500 }),
          fetchChemicalFullData({ limit: 1000 }).catch((err) => {
            console.warn("Failed to fetch chemical full data:", err);
            return { chemicals: [], total: 0 };
          }),
          fetchBusinessModels().catch((err) => {
            console.warn("Failed to fetch business models:", err);
            return [];
          }),
          fetchCurrencies().catch((err) => {
            console.warn("Failed to fetch currencies:", err);
            return ["ETB", "KES", "USD", "EUR"]; // Fallback
          }),
          fetchVendors().catch((err) => {
            console.warn("Failed to fetch vendors for pipeline:", err);
            return [];
          }),
          fetchPartnerChemicals({ limit: 1000 }).catch((err) => {
            console.warn("Failed to fetch partner chemicals:", err);
            return { partner_chemicals: [], total: 0 };
          }),
        ]);
        setCustomers(customersRes.data.customers);
        setChemicalTypes(chemicalTypesRes.chemicals);
        setChemicalFullData(chemicalFullDataRes.chemicals || []);
        setBusinessModels(businessModelsRes || []);
        setCurrencies((currenciesRes as Currency[]) || (["ETB", "KES", "USD", "EUR"] as Currency[]));
        setVendors(vendorsRes || []);
        setPartnerChemicals(partnerChemicalsRes?.partner_chemicals || []);
        console.log("Loaded dropdown data:", {
          businessModels: businessModelsRes?.length || 0,
          currencies: currenciesRes?.length || 0,
          chemicalFullData: chemicalFullDataRes.chemicals?.length || 0,
        });
      } catch (err) {
        console.error("Failed to load dropdown data:", err);
        // Set default currencies if API fails
        setCurrencies(["ETB", "KES", "USD", "EUR"]);
      }
    }
    loadDropdownData();
  }, []);

  async function loadPipelines() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSalesPipelines({
        limit: 1000, // Get more records for sorting
        offset: 0,
        customer_id: selectedCustomer || undefined,
        chemical_type_id: selectedChemicalType || undefined,
        stage: selectedStage || undefined,
      });
      
      // Group pipelines by customer_id + chemical_type_id, keep only the latest one per group
      // This creates a "folder" view where each company-product combo shows only the latest pipeline
      // When user clicks on a pipeline, they'll see ALL pipelines for that company-product in the detail page
      const groupedPipelines = new Map<string, SalesPipeline>();
      
      res.pipelines.forEach((pipeline) => {
        // Create key from customer_id and chemical_type_id (or tds_id as fallback)
        // This groups all pipelines for the same company + product together
        const productId = pipeline.chemical_type_id || pipeline.tds_id || 'none';
        const key = `${pipeline.customer_id}-${productId}`;
        const existing = groupedPipelines.get(key);
        
        if (!existing) {
          groupedPipelines.set(key, pipeline);
        } else {
          // Compare dates - keep the newest one (latest pipeline by creation date)
          // This ensures we show the most recent pipeline in the list view
          const existingDate = existing.created_at ? new Date(existing.created_at).getTime() : 0;
          const currentDate = pipeline.created_at ? new Date(pipeline.created_at).getTime() : 0;
          
          if (currentDate > existingDate) {
            groupedPipelines.set(key, pipeline);
          }
        }
      });
      
      // Convert map to array and sort by latest created_at
      const uniquePipelines = Array.from(groupedPipelines.values()).sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Newest first
      });
      
      // Apply pagination
      const paginatedPipelines = uniquePipelines.slice(offset, offset + limit);
      
      setPipelines(paginatedPipelines);
      setTotal(uniquePipelines.length);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipelines();
  }, [offset, selectedCustomer, selectedChemicalType, selectedStage]);

  function clearFilters() {
    setSelectedCustomer("");
    setSelectedChemicalType("");
    setSelectedStage("");
    setSearchQuery("");
    setOffset(0);
  }

  function openCreateForm() {
    // Pre-fill from URL params if available
    const customerParam = searchParams.get("customer");
    
    // CRITICAL: Explicitly clear editingPipeline FIRST to ensure we create a new record
    // This prevents any stale state from causing updates instead of creates
    setEditingPipeline(null);
    
    // Reset form to default values
    const newFormData: SalesPipelineCreate = {
      customer_id: customerParam || "",
      tds_id: null,
      // Don't send any legacy chemical_type_id; keep it null
      chemical_type_id: null,
      // New pipelines must always start at Lead ID stage
      stage: "Lead ID",
      amount: null,
      currency: null,
      expected_close_date: null,
      close_reason: null,
      lead_source: null,
      contact_per_lead: null,
      business_model: null,
      unit: null,
      unit_price: null,
      metadata: null,
    };
    
    setFormData(newFormData);
    setShowCreateForm(true);
    
    // Log to help debug
    console.log("Opening CREATE form - editingPipeline cleared, form reset", {
      customer_id: newFormData.customer_id,
      chemical_type_id: newFormData.chemical_type_id,
      editingPipeline: null,
      pathname: window.location.pathname
    });
  }

  // Auto-open create form if "new" param is in URL
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      // Ensure we're not on an edit route
      if (!window.location.pathname.includes("/edit")) {
        // Force clear editingPipeline before opening create form
        setEditingPipeline(null);
        openCreateForm();
        // Remove the param from URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("new");
        setSearchParams(newParams, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-open edit form if pipelineId is in URL path (from /sales/pipeline/:pipelineId/edit)
  useEffect(() => {
    // Check if we're on an edit route (pipelineId from URL params and path includes /edit)
    const urlPath = window.location.pathname;
    const isEditRoute = urlPath.endsWith("/edit") || urlPath.includes("/edit");
    
    console.log("Edit useEffect check:", { urlPipelineId, isEditRoute, urlPath, showCreateForm, editProcessedRef: editProcessedRef.current });
    
    // Only run if we have pipelineId in URL AND it's an edit route
    // AND haven't already processed this pipeline AND the form is not already showing
    if (
      urlPipelineId && 
      isEditRoute &&
      !showCreateForm &&
      editProcessedRef.current !== urlPipelineId
    ) {
      console.log("Opening edit form for pipeline:", urlPipelineId);
      // Mark as processing
      editProcessedRef.current = urlPipelineId;
      
      // Fetch the pipeline and open edit form
      async function loadAndEditPipeline() {
        if (!urlPipelineId) return;
        try {
          const pipeline = await fetchSalesPipelineById(urlPipelineId);
          if (pipeline) {
            console.log("Pipeline loaded, opening edit form:", pipeline.id);
            openEditForm(pipeline);
            // Keep the URL as is - it already shows the correct pipeline ID
          }
        } catch (err: any) {
          console.error("Failed to load pipeline for editing:", err);
          alert(err?.response?.data?.detail ?? err?.message ?? "Failed to load pipeline");
          // Navigate back to pipeline list on error
          navigate("/sales/pipeline");
          // Reset the ref so we can try again
          editProcessedRef.current = null;
        }
      }
      loadAndEditPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPipelineId, showCreateForm]);

  // CRITICAL: Ensure editingPipeline is null when form is shown for CREATE (not edit)
  useEffect(() => {
    if (showCreateForm) {
      const isEditRoute = window.location.pathname.includes("/edit");
      if (!isEditRoute && editingPipeline) {
        console.warn("Form is shown but editingPipeline is set and not on edit route. Clearing it to force CREATE mode.");
        setEditingPipeline(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateForm]);

  async function openEditForm(pipeline: SalesPipeline) {
    // Format date for HTML date input (YYYY-MM-DD)
    let formattedDate: string | null = null;
    if (pipeline.expected_close_date) {
      try {
        const date = new Date(pipeline.expected_close_date);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().split("T")[0];
        }
      } catch (e) {
        console.error("Error formatting date:", e);
      }
    }
    
    // Load TDS for the selected chemical type if available
    const chemicalTypeId = pipeline.chemical_type_id || null;
    if (chemicalTypeId) {
      try {
        const tdsRes = await fetchTDS({ 
          chemical_type_id: chemicalTypeId,
          limit: 1000 
        });
        setTdsList(tdsRes.tds || []);
      } catch (err) {
        console.error("Failed to load TDS:", err);
        setTdsList([]);
      }
    } else {
      setTdsList([]);
    }
    
    setFormData({
      customer_id: pipeline.customer_id,
      tds_id: pipeline.tds_id || null,
      chemical_type_id: pipeline.chemical_type_id || null,
      stage: pipeline.stage,
      amount: pipeline.amount || null,
      currency: pipeline.currency || null,
      expected_close_date: formattedDate,
      close_reason: pipeline.close_reason || null,
      lead_source: pipeline.lead_source || null,
      contact_per_lead: pipeline.contact_per_lead || null,
      business_model: pipeline.business_model || null,
      unit: pipeline.unit || null,
      unit_price: pipeline.unit_price || null,
      forex: pipeline.forex || null,
      business_unit: pipeline.business_unit || null,
      incoterm: pipeline.incoterm || null,
      metadata: pipeline.metadata || null,
    });
    setEditingPipeline(pipeline);
    setShowCreateForm(true);
  }

  function closeForm() {
    setShowCreateForm(false);
    setEditingPipeline(null);
    setReasonForStageChange("");
    setReasonForAmountChange("");
    setFormData({
      customer_id: "",
      tds_id: null,
      chemical_type_id: null,
      stage: "Lead ID",
      amount: null,
      currency: null,
      expected_close_date: null,
      close_reason: null,
      lead_source: null,
      contact_per_lead: null,
      business_model: null,
      unit: null,
      unit_price: null,
      forex: null,
      business_unit: null,
      incoterm: null,
      metadata: null,
    });
    // Reset the ref so we can process edit again if needed
    editProcessedRef.current = null;
    // If we're on an edit route, navigate back to pipeline list
    const urlPath = window.location.pathname;
    if (urlPath.includes("/edit")) {
      navigate("/sales/pipeline");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.customer_id) {
      alert("Customer is required");
      return;
    }

    try {
      // CRITICAL: Only update if we're explicitly on an edit route with a valid pipeline ID
      // This ensures we ALWAYS create new records when clicking "Create New Pipeline"
      const isEditRoute = window.location.pathname.includes("/edit");
      const hasEditingPipeline = editingPipeline && editingPipeline.id;
      
      console.log("handleCreate - Debug info:", {
        isEditRoute,
        hasEditingPipeline,
        editingPipelineId: editingPipeline?.id,
        pathname: window.location.pathname,
        willUpdate: isEditRoute && hasEditingPipeline,
        willCreate: !(isEditRoute && hasEditingPipeline)
      });
      
      // Force create if not on edit route, regardless of editingPipeline state
      if (isEditRoute && hasEditingPipeline) {
        console.log("UPDATE MODE: Updating existing pipeline", editingPipeline.id);
        
        // Check if stage or amount changed and require reasons
        const stageChanged = editingPipeline.stage !== formData.stage;
        const amountChanged = editingPipeline.amount !== formData.amount;
        
        if (stageChanged && !reasonForStageChange.trim()) {
          alert("Reason for stage change is required when stage changes");
          return;
        }
        
        if (amountChanged && !reasonForAmountChange.trim()) {
          alert("Reason for amount change is required when amount changes");
          return;
        }
        
        setUpdating(true);
        const updateData: SalesPipelineUpdate = {
          customer_id: formData.customer_id,
          tds_id: formData.tds_id,
          chemical_type_id: formData.chemical_type_id,
          stage: formData.stage,
          amount: formData.amount,
          currency: formData.currency,
          expected_close_date: formData.expected_close_date,
          close_reason: formData.close_reason,
          lead_source: formData.lead_source,
          contact_per_lead: formData.contact_per_lead,
          business_model: formData.business_model,
          unit: formData.unit,
          unit_price: formData.unit_price,
          forex: formData.forex,
          business_unit: formData.business_unit,
          incoterm: formData.incoterm,
          metadata: formData.metadata,
          reason_for_stage_change: stageChanged ? reasonForStageChange : null,
          reason_for_amount_change: amountChanged ? reasonForAmountChange : null,
        };
        await updateSalesPipeline(editingPipeline.id, updateData);
      } else {
        // CREATE MODE: Always create a new record
        console.log("CREATE MODE: Creating new pipeline record", {
          customer_id: formData.customer_id,
          // We no longer send a concrete chemical_type_id; let backend treat it as null
          chemical_type_id: null,
          stage: "Lead ID",
        });
        setCreating(true);
        // Explicitly clear editingPipeline before creating to prevent any confusion
        setEditingPipeline(null);
        const createData: SalesPipelineCreate = {
          ...formData,
          // chemical_type_id now stores the UUID from chemical_full_data.uuid_id
          stage: "Lead ID",
        };
        console.log("Creating pipeline with payload:", createData);
        await createSalesPipeline(createData);
      }
      closeForm();
      await loadPipelines();
    } catch (err: any) {
      console.error("Error saving pipeline:", err);
      console.error("Error details:", err?.response?.data);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save pipeline");
    } finally {
      setCreating(false);
      setUpdating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this pipeline record?")) {
      return;
    }

    try {
      setDeleting(id);
      await deleteSalesPipeline(id);
      await loadPipelines();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to delete pipeline");
    } finally {
      setDeleting(null);
    }
  }

  async function handlePipelineClick(pipelineId: string) {
    // Navigate to detail page instead of opening modal
    navigate(`/sales/pipeline/${pipelineId}`);
  }

  function handleOpenQuotationForm(pipelineId: string) {
    setQuotationPipelineId(pipelineId);
    setShowQuotationForm(true);
  }

  function handleCloseQuotationForm() {
    setShowQuotationForm(false);
    setQuotationPipelineId(null);
  }

  async function handleSaveQuotation(data: QuotationFormData) {
    if (!quotationPipelineId) return;

    try {
      // Save quotation data to pipeline metadata
      const pipeline = pipelines.find((p) => p.id === quotationPipelineId);
      if (pipeline) {
        const updateData: SalesPipelineUpdate = {
          metadata: {
            ...(pipeline.metadata || {}),
            quotation: data,
            quotation_created_at: new Date().toISOString(),
          },
        };
        await updateSalesPipeline(quotationPipelineId, updateData);
        alert("Quotation saved successfully!");
        handleCloseQuotationForm();
        await loadPipelines();
      }
    } catch (err: any) {
      console.error("Error saving quotation:", err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save quotation");
    }
  }


  function formatCurrency(amount: number | null | undefined): string {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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

  function getCustomerName(customerId: string): string {
    const customer = customers.find((c) => c.customer_id === customerId);
    return customer?.customer_name || customerId;
  }

  function getChemicalTypeName(pipeline: SalesPipeline): string {
    const chemicalTypeId = pipeline.chemical_type_id;
    
    if (!chemicalTypeId) {
      return "Unknown Product";
    }
    
    // First, try to find by UUID (uuid_id matches chemical_type_id) - NEW WAY
    const chemicalFullByUuid = chemicalFullData.find((c) => c.uuid_id === chemicalTypeId);
    if (chemicalFullByUuid?.product_name) {
      return chemicalFullByUuid.product_name;
    }
    
    // Fallback: try to find by integer ID (if chemical_type_id is a number string)
    const numericId = parseInt(String(chemicalTypeId), 10);
    if (!isNaN(numericId) && numericId > 0) {
      const chemicalFullById = chemicalFullData.find((c) => c.id === numericId);
      if (chemicalFullById?.product_name) {
        return chemicalFullById.product_name;
      }
    }
    
    // Fallback: try to find in old chemicalTypes (for backward compatibility)
    const chemicalType = chemicalTypes.find((ct) => ct.id === chemicalTypeId);
    if (chemicalType?.name) {
      return chemicalType.name;
    }
    
    // Debug log if not found
    console.error("❌ Product not found for pipeline:", {
      pipelineId: pipeline.id,
      chemical_type_id: chemicalTypeId,
      chemical_type_id_type: typeof chemicalTypeId,
      chemicalFullDataCount: chemicalFullData.length,
      hasUuidIds: chemicalFullData.filter(c => c.uuid_id).length,
      sampleProducts: chemicalFullData.slice(0, 3).map(c => ({ 
        id: c.id, 
        uuid_id: c.uuid_id, 
        name: c.product_name 
      })),
    });
    
    return "Unknown Product";
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters = selectedCustomer || selectedChemicalType || selectedStage;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 text-slate-900">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-50 shadow-lg">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Link
                  to="/"
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Link>
                <p className="inline-flex items-center text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
                  Sales · Pipeline Management
                </p>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-50 flex items-center gap-3">
                <TrendingUp className="text-emerald-400" size={32} />
                Sales Pipeline
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                Track deals through the sales pipeline. Monitor stages, deal values, and expected close dates.
              </p>
            </div>

            <button
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 active:translate-y-0"
            >
              <Plus size={20} />
              Add Pipeline
            </button>
          </div>
        </main>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => {
                  setSelectedCustomer(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Product
              </label>
              <select
                value={selectedChemicalType}
                onChange={(e) => {
                  setSelectedChemicalType(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All products</option>
                {chemicalTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(e.target.value as PipelineStage | "");
                  setOffset(0);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All stages</option>
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (() => {
          // CRITICAL: If form is shown and we're NOT on an edit route, force editingPipeline to null
          // This prevents any accidental updates when creating new pipelines
          const isEditRoute = window.location.pathname.includes("/edit");
          if (!isEditRoute && editingPipeline) {
            console.warn("Form shown but editingPipeline is set and not on edit route. Clearing editingPipeline.");
            setEditingPipeline(null);
          }
          return null;
        })()}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingPipeline && window.location.pathname.includes("/edit") ? "Edit Pipeline" : "Create New Pipeline"}
                </h2>
                {editingPipeline && !window.location.pathname.includes("/edit") && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Warning: editingPipeline is set but not on edit route. Forcing create mode.
                  </p>
                )}
              </div>
              <button
                onClick={closeForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Deal basics */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_id: e.target.value })
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.chemical_type_id || ""}
                    onChange={(e) => {
                      const productUuidId = e.target.value || null;
                      setFormData({
                        ...formData,
                        chemical_type_id: productUuidId, // Store UUID in chemical_type_id field
                        tds_id: null, // Clear tds_id when product changes
                      });
                      setTdsList([]); // Clear TDS list
                    }}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select product...</option>
                    {chemicalFullData
                      .filter((c) => c.product_name) // Show all products with names
                      .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""))
                      .map((c) => (
                        <option key={c.uuid_id || c.id} value={c.uuid_id || c.id.toString()}>
                          {c.product_name}
                          {c.vendor ? ` (${c.vendor})` : ""}
                          {c.product_category ? ` - ${c.product_category}` : ""}
                          {!c.uuid_id && " ⚠️ (No UUID)"}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Stage <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        stage: e.target.value as PipelineStage,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {/* When creating a new pipeline, only 'Lead' stage is allowed */}
                    {!editingPipeline && (
                      <option value="Lead">Lead</option>
                    )}
                    {/* When editing, allow full stage selection */}
                    {editingPipeline && PIPELINE_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  {editingPipeline && editingPipeline.stage !== formData.stage && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason for Stage Change <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reasonForStageChange}
                        onChange={(e) => setReasonForStageChange(e.target.value)}
                        required
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Explain why the stage is changing..."
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_close_date || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        expected_close_date: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Vendor
                  </label>
                  <select
                    value={formData.vendor_name || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        vendor_name: e.target.value || null,
                        metadata: {
                          ...(formData.metadata || {}),
                          vendor: e.target.value || null,
                        },
                      })
                    }
                    disabled={!formData.chemical_type_id}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!formData.chemical_type_id
                        ? "Select product first..."
                        : "Select vendor..."}
                    </option>
                    {(() => {
                      // Filter vendors based on selected product
                      if (!formData.chemical_type_id) {
                        return [];
                      }

                      // Get the selected product
                      const selectedProduct = chemicalFullData.find(
                        (c) => c.uuid_id === formData.chemical_type_id || c.id.toString() === formData.chemical_type_id
                      );

                      if (!selectedProduct) {
                        return [];
                      }

                      // Get vendors from partner_chemicals that match the product's vendor or partner_id
                      const availableVendors = new Set<string>();

                      // Add vendor from the selected product if it exists
                      if (selectedProduct.vendor) {
                        availableVendors.add(selectedProduct.vendor);
                      }

                      // Add vendors from partner_chemicals that match the product's partner_id
                      if (selectedProduct.partner_id) {
                        const matchingPartner = partnerChemicals.find(
                          (pc) => pc.id === selectedProduct.partner_id
                        );
                        if (matchingPartner?.vendor) {
                          availableVendors.add(matchingPartner.vendor);
                        }
                      }

                      // Also add vendors from partner_chemicals that have the same vendor name as the product
                      partnerChemicals.forEach((pc) => {
                        if (pc.vendor && selectedProduct.vendor && 
                            pc.vendor.toLowerCase() === selectedProduct.vendor.toLowerCase()) {
                          availableVendors.add(pc.vendor);
                        }
                      });

                      return Array.from(availableVendors).sort();
                    })().map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {formData.chemical_type_id && (
                    <p className="text-xs text-slate-500 mt-1">
                      Vendors filtered for selected product
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Lead Source
                  </label>
                  <input
                    type="text"
                    value={formData.lead_source || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lead_source: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Website, Referral, Trade Show..."
                  />
                </div>

                {/* Commercial details: Business model & unit/amount/pricing */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Model
                    {STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage) && (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>
                  <select
                    value={formData.business_model || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        business_model: e.target.value || null,
                      })
                    }
                    required={STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select business model...</option>
                    {businessModels.length > 0 ? (
                      businessModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No business models available</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Unit
                  </label>
                  <select
                    value={formData.business_unit || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        business_unit: (e.target.value as "Hayat" | "Alhadi" | "Bet-chem" | "Barracoda" | "Nyumb-Chem") || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select business unit...</option>
                    <option value="Hayat">Hayat</option>
                    <option value="Alhadi">Alhadi</option>
                    <option value="Bet-chem">Bet-chem</option>
                    <option value="Barracoda">Barracoda</option>
                    <option value="Nyumb-Chem">Nyumb-Chem</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Internal entity responsible for executing the deal. Hayat/Alhadi/Bet-chem/Barracoda: Import of Record contracts and Stock sales. Nyumb-Chem: Agency models and Direct Import.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit
                    {STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage) && (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>
                  <select
                    value={formData.unit || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        unit: e.target.value || null,
                      })
                    }
                    required={STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select unit...</option>
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="drum">drum</option>
                    <option value="bag">bag</option>
                    <option value="carton">carton</option>
                    <option value="pallet">pallet</option>
                    <option value="unit">unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Amount (Quantity)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount !== null && formData.amount !== undefined ? formData.amount : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({
                        ...formData,
                        amount: value && value !== "" ? parseFloat(value) : null,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter quantity..."
                  />
                  {editingPipeline && editingPipeline.amount !== formData.amount && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Reason for Amount Change <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reasonForAmountChange}
                        onChange={(e) => setReasonForAmountChange(e.target.value)}
                        required
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="Explain why the amount is changing..."
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit Price
                    {STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage) && (
                      <span className="text-red-500"> *</span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_price || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          unit_price: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      required={STAGES_REQUIRING_BUSINESS_DETAILS.includes(formData.stage)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Price per unit..."
                    />
                    <select
                      value={formData.currency || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currency: (e.target.value as Currency) || null,
                        })
                      }
                      className="w-24 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Currency</option>
                      {currencies.length > 0 ? (
                        currencies.map((curr) => (
                          <option key={curr} value={curr}>
                            {curr}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="ETB">ETB</option>
                          <option value="KES">KES</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Forex (Defines Currency Risk)
                  </label>
                  <select
                    value={formData.forex || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        forex: (e.target.value as "LeanChems" | "Client") || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select forex risk bearer...</option>
                    <option value="LeanChems">LeanChems (ETB transactions, LeanChems manages forex)</option>
                    <option value="Client">Client (Foreign currency, client bears risk)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Identifies who bears the foreign exchange risk and the transaction currency.
                  </p>
                </div>

                {formData.stage === "Closed" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Close Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.close_reason || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          close_reason: e.target.value || null,
                        })
                      }
                      required={formData.stage === "Closed"}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Enter reason for closing..."
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(creating || updating) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {editingPipeline ? "Update" : "Create"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Pipeline List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Pipeline Records ({total})
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading pipelines...</p>
            </div>
          ) : pipelines.length === 0 ? (
            <div className="p-12 text-center">
              <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">No pipeline records found.</p>
              <button
                onClick={openCreateForm}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Pipeline
              </button>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-4">
                {Object.entries(
                  pipelines.reduce<Record<string, SalesPipeline[]>>((acc, pipeline) => {
                    const key = pipeline.customer_id || "unknown";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(pipeline);
                    return acc;
                  }, {})
                ).map(([customerId, customerPipelines]) => {
                  const isExpanded = expandedCustomers.has(customerId);
                  const customerName = getCustomerName(customerId);
                  return (
                    <div
                      key={customerId}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                      {/* Folder header for company */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(expandedCustomers);
                          if (next.has(customerId)) {
                            next.delete(customerId);
                          } else {
                            next.add(customerId);
                          }
                          setExpandedCustomers(next);
                        }}
                        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700">
                            <Folder className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-slate-900">
                              {customerName || "Unknown Customer"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {customerPipelines.length} pipeline
                              {customerPipelines.length !== 1 ? "s" : ""} for this company
                            </p>
                          </div>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-slate-500 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {/* Folder contents: pipeline cards for this company */}
                      {isExpanded && (
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {customerPipelines.map((pipeline) => (
                              <div
                                key={pipeline.id}
                                className="bg-white rounded-xl border-2 border-slate-200 hover:border-emerald-400 hover:shadow-lg transition-all cursor-pointer p-5 space-y-4"
                                onClick={() => handlePipelineClick(pipeline.id)}
                              >
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Package className="w-4 h-4 text-slate-400" />
                                      <span className="text-sm font-semibold text-slate-800">
                                        {getChemicalTypeName(pipeline)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-slate-400" />
                                      <span className="text-xs text-slate-500">
                                        {customerName || "Unknown Customer"}
                                      </span>
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenQuotationForm(pipeline.id);
                                      }}
                                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                      title="Create Quotation"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/sales/pipeline/${pipeline.id}/edit`);
                                      }}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(pipeline.id);
                                      }}
                                      disabled={deleting === pipeline.id}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                      title="Delete"
                                    >
                                      {deleting === pipeline.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Stage */}
                                <div>
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                                      STAGE_COLORS[pipeline.stage]
                                    }`}
                                  >
                                    {pipeline.stage}
                                  </span>
                                </div>

                                {/* Amount */}
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-5 h-5 text-emerald-600" />
                                  <div>
                                    <p className="text-xs text-slate-500">Amount</p>
                                    <p className="text-lg font-bold text-slate-900">
                                      {pipeline.amount
                                        ? `${pipeline.amount.toLocaleString()} ${pipeline.currency || "USD"}`
                                        : "—"}
                                    </p>
                                  </div>
                                </div>

                                {/* Expected Close Date */}
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-5 h-5 text-blue-600" />
                                  <div>
                                    <p className="text-xs text-slate-500">Expected Close</p>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {formatDate(pipeline.expected_close_date || null)}
                                    </p>
                                  </div>
                                </div>

                                {/* Footer */}
                                <div className="pt-4 border-t border-slate-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePipelineClick(pipeline.id);
                                    }}
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:shadow-lg transition-all"
                                  >
                                    View Details
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} pipelines
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setOffset(Math.min((totalPages - 1) * limit, offset + limit))}
                      disabled={offset + limit >= total}
                      className="px-3 py-1 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Quotation Form Modal */}
      {showQuotationForm && quotationPipelineId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4 overflow-y-auto">
          <div className="mx-auto bg-white rounded-xl shadow-xl max-w-6xl w-full my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <QuotationForm
              pipelineId={quotationPipelineId}
              customerId={pipelines.find((p) => p.id === quotationPipelineId)?.customer_id}
              pipelineData={(() => {
                const pipeline = pipelines.find((p) => p.id === quotationPipelineId);
                if (!pipeline) return null;
                
                // Get product name from chemical_full_data
                const productName = getChemicalTypeName(pipeline);
                
                // Get vendor from metadata or from chemical_full_data
                let vendorName = (pipeline.metadata as any)?.vendor_name || null;
                if (!vendorName && pipeline.chemical_type_id) {
                  // Try to get vendor from chemical_full_data
                  const chemicalFullByUuid = chemicalFullData.find((c) => c.uuid_id === pipeline.chemical_type_id);
                  if (chemicalFullByUuid?.vendor) {
                    vendorName = chemicalFullByUuid.vendor;
                  } else {
                    const numericId = parseInt(String(pipeline.chemical_type_id), 10);
                    if (!isNaN(numericId) && numericId > 0) {
                      const chemicalFullById = chemicalFullData.find((c) => c.id === numericId);
                      if (chemicalFullById?.vendor) {
                        vendorName = chemicalFullById.vendor;
                      }
                    }
                  }
                }
                
                return {
                  product_name: productName !== "Unknown Product" ? productName : null,
                  chemical_type_id: pipeline.chemical_type_id || null,
                  vendor_name: vendorName,
                  unit_price: pipeline.unit_price || null,
                  unit: pipeline.unit || null,
                };
              })()}
              onSave={handleSaveQuotation}
              onCancel={handleCloseQuotationForm}
              initialData={
                quotationPipelineId
                  ? pipelines.find((p) => p.id === quotationPipelineId)?.metadata?.quotation
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

