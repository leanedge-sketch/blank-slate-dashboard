import axios from "axios";

// Base API client for talking to FastAPI backend.
// Adjust baseURL if your backend runs on a different host/port.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Customer {
  customer_id: string;
  customer_name: string;
  display_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  product_alignment_scores?: Record<string, number> | null; // Strategic-Fit Matrix: {"Cement": 0-3, "Dry-Mix": 0-3, ...}
  sales_stage?: string | null; // Current sales stage (1-7 from Brian Tracy process)
  website_url?: string | null;
  linkedin_company_url?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
  latest_profile_text?: string | null;
  latest_profile_updated_at?: string | null;
  external_last_fetched_at?: string | null;
}

export interface Interaction {
  id: string;
  customer_id: string;
  user_id?: string | null;
  input_text?: string | null;
  ai_response?: string | null;
  file_url?: string | null;
  file_type?: string | null;
  tds_id?: string | null;
  pipeline_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CustomerListResponse {
  customers: Customer[];
  total: number;
}

export interface InteractionListResponse {
  interactions: Interaction[];
  total: number;
}

export interface CustomerChatRequest {
  input_text: string;
  tds_id?: string | null;
}

export interface InteractionUpdate {
  input_text?: string | null;
  ai_response?: string | null;
  tds_id?: string | null;
  pipeline_id?: string | null;
}

export interface CustomerUpdate {
  customer_name?: string | null;
  display_id?: string | null;
  sales_stage?: string | null;
  website_url?: string | null;
  linkedin_company_url?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  primary_contact_phone?: string | null;
}

export interface CustomerProfileFeedback {
  id: string;
  customer_id: string;
  rating: number;
  comment?: string | null;
  user_id?: string | null;
  created_at?: string | null;
}

export interface CustomerProfileFeedbackCreate {
  rating: number;
  comment?: string | null;
}

export interface CustomerProfileUpdate {
  profile_text: string;
}

// =============================
// CRM API Functions
// =============================

export async function fetchCustomers(params?: {
  limit?: number;
  offset?: number;
  q?: string;
  start_date?: string;
  end_date?: string;
}): Promise<CustomerListResponse> {
  const res = await api.get<CustomerListResponse>("/crm/customers", {
    params: {
      limit: params?.limit ?? 1000,
      offset: params?.offset ?? 0,
      ...(params?.q && { q: params.q }),
      ...(params?.start_date && { start_date: params.start_date }),
      ...(params?.end_date && { end_date: params.end_date }),
    },
  });
  return res.data;
}

export async function updateCustomerProfile(
  customerId: string,
  body: CustomerProfileUpdate
) {
  const res = await api.put<Customer>(`/crm/customers/${customerId}/profile`, body);
  return res.data;
}

export async function fetchCustomerProfileFeedback(customerId: string, limit = 10) {
  const res = await api.get<CustomerProfileFeedback[]>(
    `/crm/customers/${customerId}/profile/feedback`,
    { params: { limit } }
  );
  return res.data;
}

export async function submitCustomerProfileFeedback(
  customerId: string,
  body: CustomerProfileFeedbackCreate
) {
  const res = await api.post<CustomerProfileFeedback>(
    `/crm/customers/${customerId}/profile/feedback`,
    body
  );
  return res.data;
}

// =============================
// PMS API Functions
// =============================

// Chemical Types
export async function fetchChemicalTypes(params?: { limit?: number; offset?: number }) {
  const res = await api.get<ChemicalTypeListResponse>("/pms/chemicals", {
    params: {
      limit: params?.limit ?? 200,
      offset: params?.offset ?? 0,
    },
  });
  return res.data;
}

export async function createChemicalType(data: ChemicalTypeCreate) {
  const res = await api.post<ChemicalType>("/pms/chemicals", data);
  return res.data;
}

export interface ChemicalTypeUpdate {
  name?: string | null;
  category?: string | null;
  hs_code?: string | null;
  applications?: string[] | null;
  spec_template?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export async function updateChemicalType(id: string, data: ChemicalTypeUpdate) {
  const res = await api.put<ChemicalType>(`/pms/chemicals/${id}`, data);
  return res.data;
}

export async function deleteChemicalType(id: string) {
  await api.delete(`/pms/chemicals/${id}`);
}

// TDS
export async function fetchTDS(params?: {
  limit?: number;
  offset?: number;
  brand?: string;
  grade?: string;
  owner?: string;
  chemical_type_id?: string;
}) {
  const res = await api.get<TdsListResponse>("/pms/tds", { params });
  return res.data;
}

export async function fetchTDSById(id: string) {
  const res = await api.get<Tds>(`/pms/tds/${id}`);
  return res.data;
}

export async function createTDS(data: TdsCreate) {
  const res = await api.post<Tds>("/pms/tds", data);
  return res.data;
}

export interface TdsUpdate {
  chemical_type_id?: string | null;
  brand?: string | null;
  grade?: string | null;
  owner?: string | null;
  source?: string | null;
  specs?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

export async function updateTDS(id: string, data: TdsUpdate) {
  const res = await api.put<Tds>(`/pms/tds/${id}`, data);
  return res.data;
}

export async function deleteTDS(id: string) {
  await api.delete(`/pms/tds/${id}`);
}

// Partners
export async function fetchPartners(params?: {
  limit?: number;
  offset?: number;
  partner_name?: string;
}) {
  const res = await api.get<PartnerListResponse>("/pms/partners", { params });
  return res.data;
}

export async function createPartner(data: PartnerCreate) {
  const res = await api.post<Partner>("/pms/partners", data);
  return res.data;
}

export interface PartnerUpdate {
  partner?: string | null;
  partner_country?: string | null;
  metadata?: Record<string, any> | null;
}

export async function updatePartner(id: string, data: PartnerUpdate) {
  const res = await api.put<Partner>(`/pms/partners/${id}`, data);
  return res.data;
}

export async function deletePartner(id: string) {
  await api.delete(`/pms/partners/${id}`);
}

// LeanChem Products
export async function fetchProducts(params?: {
  limit?: number;
  offset?: number;
  category?: string;
  product_type?: string;
  tds_id?: string;
}) {
  const res = await api.get<LeanchemProductListResponse>("/pms/products", { params });
  return res.data;
}

export async function createProduct(data: LeanchemProductCreate) {
  const res = await api.post<LeanchemProduct>("/pms/products", data);
  return res.data;
}

export interface LeanchemProductUpdate {
  tds_id?: string | null;
  category?: string | null;
  product_type?: string | null;
  sample_addis?: Record<string, any> | null;
  stock_addis?: Record<string, any> | null;
  stock_nairobi?: Record<string, any> | null;
  prices?: Record<string, any> | null;
}

export async function updateProduct(id: string, data: LeanchemProductUpdate) {
  const res = await api.put<LeanchemProduct>(`/pms/products/${id}`, data);
  return res.data;
}

export async function deleteProduct(id: string) {
  await api.delete(`/pms/products/${id}`);
}

// Pricing
export async function fetchPricing(params?: {
  limit?: number;
  offset?: number;
  partner_id?: string;
  tds_id?: string;
}) {
  const res = await api.get<CostingPricingListResponse>("/pms/pricing", { params });
  return res.data;
}

export async function createPricing(data: CostingPricingCreate) {
  const res = await api.post<CostingPricing>("/pms/pricing", data);
  return res.data;
}

export interface CostingPricingUpdate {
  partner_id?: string | null;
  tds_id?: string | null;
  rows?: Record<string, any>[] | null;
}

export async function updatePricing(
  partnerId: string,
  tdsId: string,
  data: CostingPricingUpdate
) {
  const res = await api.put<CostingPricing>(`/pms/pricing/${partnerId}/${tdsId}`, data);
  return res.data;
}

export async function deletePricing(partnerId: string, tdsId: string) {
  await api.delete(`/pms/pricing/${partnerId}/${tdsId}`);
}

// Partner Chemicals (simplified schema: vendor, country, metadata)
export interface PartnerChemical {
  id: string;
  vendor: string;
  country?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Legacy fields for backward compatibility
  product_category?: string | null;
  sub_category?: string | null;
  product_name?: string | null;
  brand?: string | null;
  packing?: string | null;
  price?: number | null;
  competitive_price?: number | null;
  cost?: number | null;
  tds_id?: string | null;
}

export interface PartnerChemicalListResponse {
  partner_chemicals: PartnerChemical[];
  total: number;
}

export interface PartnerChemicalCreate {
  vendor: string;
  country?: string | null;
  metadata?: Record<string, any> | null;
}

export interface PartnerChemicalUpdate {
  vendor?: string | null;
  country?: string | null;
  metadata?: Record<string, any> | null;
}

export async function fetchPartnerChemicals(params?: {
  limit?: number;
  offset?: number;
  vendor?: string;
  product_category?: string;
  sub_category?: string;
}) {
  const res = await api.get<PartnerChemicalListResponse>("/pms/partner-chemicals", { params });
  return res.data;
}

export async function createPartnerChemical(data: PartnerChemicalCreate) {
  const res = await api.post<PartnerChemical>("/pms/partner-chemicals", data);
  return res.data;
}

export async function updatePartnerChemical(id: string, data: PartnerChemicalUpdate) {
  const res = await api.put<PartnerChemical>(`/pms/partner-chemicals/${id}`, data);
  return res.data;
}

export async function deletePartnerChemical(id: string) {
  await api.delete(`/pms/partner-chemicals/${id}`);
}

export async function fetchPartnerChemical(id: string) {
  const res = await api.get<PartnerChemical>(`/pms/partner-chemicals/${id}`);
  return res.data;
}

export async function fetchVendors() {
  const res = await api.get<string[]>("/pms/partner-chemicals/vendors");
  return res.data;
}

export async function fetchProductCategories() {
  const res = await api.get<string[]>("/pms/partner-chemicals/product-categories");
  return res.data;
}

export async function fetchSubCategories() {
  const res = await api.get<string[]>("/pms/partner-chemicals/sub-categories");
  return res.data;
}

// Chemical Full Data
export interface ChemicalFullData {
  id: number;
  uuid_id?: string | null;  // UUID for linking with pipelines
  vendor?: string | null;
  product_category?: string | null;
  sub_category?: string | null;
  product_name?: string | null;
  packing?: string | null;
  typical_application?: string | null;
  product_description?: string | null;
  hs_code?: string | null;
  price?: number | null;
  industry?: string | null;
  sector?: string | null;
  partner_id?: string | null;
}

export interface ChemicalFullDataListResponse {
  chemicals: ChemicalFullData[];
  total: number;
}

export interface ChemicalFullDataCreate {
  vendor?: string | null;
  product_category?: string | null;
  sub_category?: string | null;
  product_name?: string | null;
  packing?: string | null;
  typical_application?: string | null;
  product_description?: string | null;
  hs_code?: string | null;
  price?: number | null;
  industry?: string | null;
  sector?: string | null;
  partner_id?: string | null;
}

export async function fetchChemicalFullData(params?: {
  limit?: number;
  offset?: number;
  sector?: string;
  industry?: string;
  vendor?: string;
  product_category?: string;
  sub_category?: string;
}) {
  const res = await api.get<ChemicalFullDataListResponse>("/pms/chemical-full-data", { params });
  return res.data;
}

export async function createChemicalFullData(data: ChemicalFullDataCreate & { id: number }) {
  const res = await api.post<ChemicalFullData>("/pms/chemical-full-data", data);
  return res.data;
}

export async function updateChemicalFullData(
  id: number,
  data: ChemicalFullDataUpdate
) {
  const res = await api.put<ChemicalFullData>(`/pms/chemical-full-data/${id}`, data);
  return res.data;
}

export async function deleteChemicalFullData(id: number) {
  await api.delete(`/pms/chemical-full-data/${id}`);
}

export async function fetchSectors() {
  const res = await api.get<string[]>("/pms/chemical-full-data/options/sectors");
  return res.data;
}

export async function fetchIndustries() {
  const res = await api.get<string[]>("/pms/chemical-full-data/options/industries");
  return res.data;
}

export async function fetchProductNames() {
  const res = await api.get<string[]>("/pms/chemical-full-data/options/product-names");
  return res.data;
}

export async function fetchProductCategoriesFullData() {
  const res = await api.get<string[]>("/pms/chemical-full-data/options/product-categories");
  return res.data;
}

export async function fetchSubCategoriesFullData() {
  const res = await api.get<string[]>("/pms/chemical-full-data/options/sub-categories");
  return res.data;
}

// =============================
// PMS: Chemical Types
// =============================
export interface ChemicalType {
  id: string;
  name: string;
  category?: string | null;
  hs_code?: string | null;
  applications?: string[] | null;
  spec_template?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
}

export interface ChemicalTypeListResponse {
  chemicals: ChemicalType[];
  total: number;
}

export interface ChemicalTypeCreate {
  name: string;
  category?: string | null;
  hs_code?: string | null;
  applications?: string[] | null;
  spec_template?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

// =============================
// PMS: TDS Data
// =============================
export interface Tds {
  id: string;
  chemical_type_id?: string | null;
  brand?: string | null;
  grade?: string | null;
  owner?: string | null;
  source?: string | null;
  specs?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TdsListResponse {
  tds: Tds[];
  total: number;
}

export interface TdsCreate {
  chemical_type_id?: string | null;
  brand?: string | null;
  grade?: string | null;
  owner?: string | null;
  source?: string | null;
  specs?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

// =============================
// PMS: Partners
// =============================
export interface Partner {
  id: string;
  partner?: string | null;
  partner_country?: string | null;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PartnerListResponse {
  partners: Partner[];
  total: number;
}

export interface PartnerCreate {
  partner?: string | null;
  partner_country?: string | null;
  metadata?: Record<string, any> | null;
}

// =============================
// PMS: LeanChem Products
// =============================
export interface LeanchemProduct {
  id: string;
  tds_id?: string | null;
  category?: string | null;
  product_type?: string | null;
  sample_addis?: Record<string, any> | null;
  stock_addis?: Record<string, any> | null;
  stock_nairobi?: Record<string, any> | null;
  prices?: Record<string, any> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LeanchemProductListResponse {
  products: LeanchemProduct[];
  total: number;
}

export interface LeanchemProductCreate {
  tds_id?: string | null;
  category?: string | null;
  product_type?: string | null;
  sample_addis?: Record<string, any> | null;
  stock_addis?: Record<string, any> | null;
  stock_nairobi?: Record<string, any> | null;
  prices?: Record<string, any> | null;
}

// =============================
// PMS: Costing/Pricing
// =============================
export interface CostingPricing {
  partner_id: string;
  tds_id: string;
  rows?: Record<string, any>[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CostingPricingListResponse {
  pricing: CostingPricing[];
  total: number;
}

export interface CostingPricingCreate {
  partner_id: string;
  tds_id: string;
  rows?: Record<string, any>[] | null;
}

// Dashboard Models
export interface DashboardMetrics {
  total_customers: number;
  total_interactions: number;
  customers_with_interactions: number;
  sales_stages_distribution: Record<string, number>;
}

// =============================
// SALES PIPELINE API
// =============================

// Pipeline Stages (union type) – must match backend PIPELINE_STAGES
export type PipelineStage =
  | "Lead ID"
  | "Discovery"
  | "Sample"
  | "Validation"
  | "Proposal"
  | "Confirmation"
  | "Closed"
  | "Lost";

export type Currency = "ETB" | "KES" | "USD" | "EUR";
export type Forex = "LeanChems" | "Client";
export type BusinessUnit = "Hayat" | "Alhadi" | "Bet-chem" | "Barracoda" | "Nyumb-Chem";
export type Incoterm = "Import of Record" | "Agency" | "Direct Import" | "Stock – Addis Ababa";

// Sales Pipeline Interfaces
export interface SalesPipeline {
  id: string;
  customer_id: string;
  tds_id?: string | null;
  chemical_type_id?: string | null;
  stage: PipelineStage;
  amount?: number | null;
  currency?: Currency | null;
  expected_close_date?: string | null; // ISO date string
  close_reason?: string | null;
  lead_source?: string | null;
  contact_per_lead?: string | null;
  business_model?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  forex?: Forex | null;
  business_unit?: BusinessUnit | null;
  incoterm?: Incoterm | null;
  metadata?: Record<string, any> | null;
  ai_interactions?: Array<{
    timestamp: string;
    user_input: string;
    ai_response: string;
    user_id?: string | null;
  }> | null;
  created_at?: string | null;
  updated_at?: string | null;
  parent_pipeline_id?: string | null;
  version_number?: number | null;
  reason_for_stage_change?: string | null;
  reason_for_amount_change?: string | null;
  is_current_version?: boolean | null;
}

export interface SalesPipelineCreate {
  customer_id: string;
  tds_id?: string | null;
  chemical_type_id?: string | null;
  stage: PipelineStage;
  amount?: number | null;
  currency?: Currency | null;
  expected_close_date?: string | null;
  close_reason?: string | null;
  lead_source?: string | null;
  contact_per_lead?: string | null;
  business_model?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  forex?: Forex | null;
  business_unit?: BusinessUnit | null;
  incoterm?: Incoterm | null;
  metadata?: Record<string, any> | null;
  // Optional vendor name from partner_chemicals (we'll store it in metadata on the backend)
  vendor_name?: string | null;
}

export interface SalesPipelineUpdate {
  customer_id?: string | null;
  tds_id?: string | null;
  chemical_type_id?: string | null;
  stage?: PipelineStage | null;
  amount?: number | null;
  currency?: Currency | null;
  expected_close_date?: string | null;
  close_reason?: string | null;
  lead_source?: string | null;
  contact_per_lead?: string | null;
  business_model?: string | null;
  unit?: string | null;
  unit_price?: number | null;
  forex?: Forex | null;
  business_unit?: BusinessUnit | null;
  incoterm?: Incoterm | null;
  metadata?: Record<string, any> | null;
  reason_for_stage_change?: string | null;
  reason_for_amount_change?: string | null;
}

export interface SalesPipelineListResponse {
  pipelines: SalesPipeline[];
  total: number;
}

export interface PipelineForecast {
  forecast_period_days: number;
  total_forecast_value: number;
  forecast_by_stage: Record<string, number>;
  forecast_by_week: Record<string, number>;
  pipeline_count: number;
}

export interface PipelineInsights {
  total_pipeline_value: number;
  forecast_value: number;
  stage_distribution: Record<string, number>;
  churn_risk_pipelines: Array<{
    pipeline_id: string;
    stage: string;
    days_in_stage: number;
    customer_id: string;
  }>;
  sample_effectiveness: number;
  product_demand: Record<string, number>;
  insights_summary: string;
}

export interface StageDetectionResult {
  detected_stage: PipelineStage;
  confidence: "high" | "medium" | "low";
  reason: string;
  close_reason?: string | null;
  metadata?: Record<string, any>;
}

// Sales Pipeline API Functions
export async function fetchSalesPipelines(params?: {
  limit?: number;
  offset?: number;
  customer_id?: string;
  tds_id?: string;
  chemical_type_id?: string;
  stage?: PipelineStage;
}) {
  const res = await api.get<SalesPipelineListResponse>("/sales-pipeline", {
    params: {
      limit: params?.limit ?? 100,
      offset: params?.offset ?? 0,
      customer_id: params?.customer_id,
      tds_id: params?.tds_id,
      chemical_type_id: params?.chemical_type_id,
      stage: params?.stage,
    },
  });
  return res.data;
}

export async function fetchSalesPipelineById(id: string) {
  const res = await api.get<SalesPipeline>(`/sales-pipeline/${id}`);
  return res.data;
}

export async function fetchPipelineVersions(id: string) {
  const res = await api.get<SalesPipelineListResponse>(`/sales-pipeline/${id}/versions`);
  return res.data.pipelines;
}

export async function createSalesPipeline(data: SalesPipelineCreate) {
  const res = await api.post<SalesPipeline>("/sales-pipeline", data);
  return res.data;
}

export async function updateSalesPipeline(
  id: string,
  data: SalesPipelineUpdate
) {
  const res = await api.put<SalesPipeline>(`/sales-pipeline/${id}`, data);
  return res.data;
}

export async function deleteSalesPipeline(id: string) {
  await api.delete(`/sales-pipeline/${id}`);
}

export async function advancePipelineStage(
  id: string,
  newStage: PipelineStage,
  metadataUpdates?: Record<string, any>
) {
  const res = await api.post<SalesPipeline>(
    `/sales-pipeline/${id}/advance-stage`,
    {
      new_stage: newStage,
      metadata_updates: metadataUpdates,
    }
  );
  return res.data;
}

export async function autoDetectStage(data: {
  interaction_text: string;
  current_stage?: PipelineStage | null;
  customer_name?: string | null;
  product_name?: string | null;
}) {
  const res = await api.post<StageDetectionResult>(
    "/sales-pipeline/auto-detect",
    data
  );
  return res.data;
}

export async function autoAdvancePipelineStage(
  id: string,
  data: {
    interaction_text: string;
    customer_name?: string | null;
    product_name?: string | null;
  }
) {
  const res = await api.post<SalesPipeline>(
    `/sales-pipeline/${id}/auto-advance`,
    data
  );
  return res.data;
}

// Get business models from Business_Model table
export async function fetchBusinessModels(): Promise<string[]> {
  try {
    const res = await api.get<{ business_models: string[] }>(
      "/sales-pipeline/business-models"
    );
    return res.data.business_models || [];
  } catch (error) {
    console.warn("Failed to fetch business models from API:", error);
    return [];
  }
}

// Get supported currencies
export async function fetchCurrencies(): Promise<Currency[]> {
  try {
    const res = await api.get<{ currencies: Currency[] }>(
      "/sales-pipeline/currencies"
    );
    return res.data.currencies;
  } catch (error) {
    // Fallback to hardcoded currencies if API fails
    console.warn("Failed to fetch currencies from API, using default:", error);
    return ["ETB", "KES", "USD", "EUR"];
  }
}

// Get pipeline stages
export async function fetchPipelineStages(): Promise<PipelineStage[]> {
  const res = await api.get<{ stages: PipelineStage[] }>(
    "/sales-pipeline/stages"
  );
  return res.data.stages;
}

export async function getPipelineForecast(params?: {
  days_ahead?: number;
  customer_id?: string;
}) {
  const res = await api.get<PipelineForecast>("/sales-pipeline/forecast", {
    params: {
      days_ahead: params?.days_ahead ?? 30,
      customer_id: params?.customer_id,
    },
  });
  return res.data;
}

export async function getPipelineInsights(params?: {
  customer_id?: string;
  tds_id?: string;
  days_back?: number;
}) {
  const res = await api.get<PipelineInsights>("/sales-pipeline/insights", {
    params: {
      customer_id: params?.customer_id,
      tds_id: params?.tds_id,
      days_back: params?.days_back ?? 90,
    },
  });
  return res.data;
}

// =============================
// STOCK MANAGEMENT
// =============================

export interface Product {
  id: string;
  chemical: string;
  chemical_type: string;
  brand: string;
  packaging: string;
  kg_per_unit: number;
  use_case: "sales" | "internal";
  tds_id?: string | null;
  tds_link?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_stock_addis_ababa: number;
  total_stock_sez_kenya: number;
  total_stock_nairobi_partner: number;
  reserved_stock_addis_ababa: number;
  reserved_stock_sez_kenya: number;
  reserved_stock_nairobi_partner: number;
  available_stock_addis_ababa: number;
  available_stock_sez_kenya: number;
  available_stock_nairobi_partner: number;
  total_stock: number;
  total_reserved_stock: number;
  total_available_stock: number;
}

export interface ProductCreate {
  chemical: string;
  chemical_type: string;
  brand: string;
  packaging: string;
  kg_per_unit: number;
  use_case: "sales" | "internal";
  tds_id?: string | null;
  tds_link?: string | null;
}

export interface ProductUpdate {
  chemical?: string;
  chemical_type?: string;
  brand?: string;
  packaging?: string;
  kg_per_unit?: number;
  use_case?: "sales" | "internal";
  tds_link?: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  tds_id?: string | null;
  date: string; // ISO date string
  location: "addis_ababa" | "sez_kenya" | "nairobi_partner";
  transaction_type: "Sales" | "Purchase" | "Inter-company transfer" | "Sample" | "Damage" | "Stock Availability";
  unit: string;
  beginning_balance: number;
  purchase_kg: number;
  sold_kg: number;
  purchase_direct_shipment_kg: number;
  sold_direct_shipment_kg: number;
  sample_or_damage_kg: number;
  inter_company_transfer_kg: number;
  transfer_to_location?: "addis_ababa" | "sez_kenya" | "nairobi_partner" | null;
  balance_kg: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  business_model?: "Stock" | "Direct Delivery" | null;
  brand?: string | null;
  reference?: string | null;
  remark?: string | null;
  warehouse?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StockMovementCreate {
  product_id: string;
  tds_id?: string | null;
  date: string; // ISO date string
  location: "addis_ababa" | "sez_kenya" | "nairobi_partner";
  transaction_type: "Sales" | "Purchase" | "Inter-company transfer" | "Sample" | "Damage" | "Stock Availability";
  unit?: string;
  beginning_balance?: number;
  purchase_kg?: number;
  sold_kg?: number;
  purchase_direct_shipment_kg?: number;
  sold_direct_shipment_kg?: number;
  sample_or_damage_kg?: number;
  inter_company_transfer_kg?: number;
  transfer_to_location?: "addis_ababa" | "sez_kenya" | "nairobi_partner" | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  business_model?: "Stock" | "Direct Delivery" | null;
  brand?: string | null;
  reference?: string | null;
  remark?: string | null;
  warehouse?: string | null;
}

export interface StockMovementUpdate {
  date?: string;
  location?: "addis_ababa" | "sez_kenya" | "nairobi_partner";
  transaction_type?: "Sales" | "Purchase" | "Inter-company transfer" | "Sample" | "Damage" | "Stock Availability";
  unit?: string;
  beginning_balance?: number;
  purchase_kg?: number;
  sold_kg?: number;
  purchase_direct_shipment_kg?: number;
  sold_direct_shipment_kg?: number;
  sample_or_damage_kg?: number;
  inter_company_transfer_kg?: number;
  transfer_to_location?: "addis_ababa" | "sez_kenya" | "nairobi_partner" | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  business_model?: "Stock" | "Direct Delivery" | null;
  brand?: string | null;
  reference?: string | null;
  remark?: string | null;
  warehouse?: string | null;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  limit: number;
  offset: number;
}

export interface StockMovementListResponse {
  movements: StockMovement[];
  total: number;
  limit: number;
  offset: number;
}

export interface StockAvailabilitySummary {
  product_id: string;
  product_name: string;
  chemical: string;
  brand: string;
  addis_ababa_stock: number;
  sez_kenya_stock: number;
  nairobi_partner_stock: number;
  total_stock: number;
  addis_ababa_reserved: number;
  sez_kenya_reserved: number;
  nairobi_partner_reserved: number;
  total_reserved: number;
  addis_ababa_available: number;
  sez_kenya_available: number;
  nairobi_partner_available: number;
  total_available: number;
}

// Stock Product API functions
export async function fetchStockProducts(params?: {
  limit?: number;
  offset?: number;
  chemical?: string;
  brand?: string;
  use_case?: "sales" | "internal";
}): Promise<ProductListResponse> {
  const response = await api.get<ProductListResponse>("/stock/products", { params });
  return response.data;
}

export async function fetchStockProductById(productId: string): Promise<Product> {
  const response = await api.get<Product>(`/stock/products/${productId}`);
  return response.data;
}

export async function fetchStockProductByTdsId(tdsId: string): Promise<Product> {
  const response = await api.get<Product>(`/stock/products/by-tds/${tdsId}`);
  return response.data;
}

export async function createStockProduct(product: ProductCreate): Promise<Product> {
  const response = await api.post<Product>("/stock/products", product);
  return response.data;
}

export async function updateStockProduct(productId: string, product: ProductUpdate): Promise<Product> {
  const response = await api.put<Product>(`/stock/products/${productId}`, product);
  return response.data;
}

export async function deleteStockProduct(productId: string): Promise<void> {
  await api.delete(`/stock/products/${productId}`);
}

// Stock Movement API functions
export async function fetchStockMovements(params?: {
  limit?: number;
  offset?: number;
  product_id?: string;
  location?: "addis_ababa" | "sez_kenya" | "nairobi_partner";
  transaction_type?: "Sales" | "Purchase" | "Inter-company transfer" | "Sample" | "Damage";
  business_model?: string;
  start_date?: string;
  end_date?: string;
}): Promise<StockMovementListResponse> {
  const response = await api.get<StockMovementListResponse>("/stock/movements", { params });
  return response.data;
}

export async function fetchStockMovementById(movementId: string): Promise<StockMovement> {
  const response = await api.get<StockMovement>(`/stock/movements/${movementId}`);
  return response.data;
}

export async function createStockMovement(movement: StockMovementCreate): Promise<StockMovement> {
  const response = await api.post<StockMovement>("/stock/movements", movement);
  return response.data;
}

export async function updateStockMovement(
  movementId: string,
  movement: StockMovementUpdate
): Promise<StockMovement> {
  const response = await api.put<StockMovement>(`/stock/movements/${movementId}`, movement);
  return response.data;
}

export async function deleteStockMovement(movementId: string): Promise<void> {
  await api.delete(`/stock/movements/${movementId}`);
}

// Stock Availability API functions
export async function fetchStockAvailability(params?: {
  limit?: number;
  offset?: number;
  chemical?: string;
  brand?: string;
}): Promise<StockAvailabilitySummary[]> {
  const response = await api.get<StockAvailabilitySummary[]>("/stock/availability", { params });
  return response.data;
}

// =============================
// AUTHENTICATION / EMPLOYEE CHECK
// =============================

export interface EmployeeCheckResponse {
  is_employee: boolean;
  email: string;
  role: string | null;
  name: string | null;
}

export async function checkEmployeeStatus(email: string): Promise<EmployeeCheckResponse> {
  const response = await api.get<EmployeeCheckResponse>("/auth/check-employee", {
    params: { email },
  });
  return response.data;
}

