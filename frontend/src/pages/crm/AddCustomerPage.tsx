import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { api, Customer, buildCustomerProfile } from "../../services/api";
import { CompanyContactSearchPanel } from "../../components/crm/CompanyContactSearchPanel";
import {
  PipelineDealModeTabs,
  type DealLinkMode,
} from "../../components/sales/PipelineDealLinkFields";

type InitialPipelineStage = "Lead ID" | "Discovery" | "Sample";

interface CustomerFormState {
  customer_name: string;
  initial_pipeline_stage: InitialPipelineStage;
}

export function AddCustomerPage() {
  const [form, setForm] = useState<CustomerFormState>({
    customer_name: "",
    initial_pipeline_stage: "Lead ID",
  });
  const [pipelineDealMode, setPipelineDealMode] =
    useState<DealLinkMode>("new");
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedExistingCustomerId, setSelectedExistingCustomerId] =
    useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<Customer | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<{ customers: Customer[] }>("/crm/customers", { params: { limit: 500 } })
      .then((res) => setExistingCustomers(res.data.customers ?? []))
      .catch(() => setExistingCustomers([]));
  }, []);

  function handleContinueExistingCustomer() {
    if (!selectedExistingCustomerId) {
      setError("Select an existing customer to continue their pipeline.");
      return;
    }
    navigate(
      `/sales/pipeline?customer=${selectedExistingCustomerId}&new=true&deal_mode=existing`,
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pipelineDealMode === "existing") {
      handleContinueExistingCustomer();
      return;
    }
    if (!form.customer_name.trim()) {
      setError("Customer name is required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const payload: CustomerFormState = {
        customer_name: form.customer_name.trim(),
        initial_pipeline_stage: form.initial_pipeline_stage,
      };

      const res = await api.post<Customer>("/crm/customers", payload);
      const created = res.data;
      setCreatedCustomer(created);
      setSuccess(
        "Customer created successfully! Build the AI profile when ready using the button below.",
      );
      
      // Automatically auto-fill sales stage after creating customer
      try {
        const stageRes = await api.post<Customer>(`/crm/customers/${created.customer_id}/auto-fill-sales-stage`);
        setCreatedCustomer(stageRes.data); // Update with sales stage
        console.log("Sales stage auto-filled:", stageRes.data.sales_stage);
      } catch (stageErr: any) {
        console.error("Auto-fill sales stage error:", stageErr);
        // Don't show error - customer was created
      }
    } catch (err: any) {
      console.error(err);
      // Handle validation errors (422) from FastAPI
      let errorMessage = "Failed to create customer.";
      if (err?.response?.status === 422) {
        const validationErrors = err?.response?.data?.detail;
        if (Array.isArray(validationErrors)) {
          errorMessage = validationErrors.map((e: any) => e.msg || e.message || String(e)).join(", ");
        } else if (typeof validationErrors === "string") {
          errorMessage = validationErrors;
        } else if (validationErrors?.msg) {
          errorMessage = validationErrors.msg;
        } else {
          errorMessage = "Validation error: Invalid request parameters";
        }
      } else {
        errorMessage = err?.response?.data?.detail ?? err?.message ?? "Failed to create customer.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleBuildProfile() {
    if (!createdCustomer) return;

    try {
      setBuildingProfile(true);
      setProfileError(null);
      setProfileResult(null);

      console.log("Building profile for customer:", createdCustomer.customer_id);
      const data = await buildCustomerProfile(createdCustomer.customer_id, {
        quick: false,
      });
      console.log("Profile build response:", data);
      setProfileResult(data);
      setSuccess("Profile built successfully! The profile has been saved as an interaction.");
    } catch (err: unknown) {
      console.error("Profile build error:", err);
      const msg = err instanceof Error ? err.message : "Failed to build profile.";
      setProfileError(msg);
    } finally {
      setBuildingProfile(false);
    }
  }

  function handleViewCustomer() {
    if (createdCustomer) {
      navigate(`/crm/customers/${createdCustomer.customer_id}`);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Add New Customer</h2>
          <p className="page-subtitle">
            Create a customer record that you can later manage with the AI
            assistant and interaction history.
          </p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {success && <div className="info-banner">{success}</div>}
      {profileError && <div className="error-banner">{profileError}</div>}

      {!createdCustomer ? (
        <section className="card">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-900">Pipeline deal</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Same company & product again? Use Old pipeline — do not create a duplicate.
              </p>
            </div>
            <PipelineDealModeTabs
              mode={pipelineDealMode}
              onChange={setPipelineDealMode}
              canContinueExisting={existingCustomers.length > 0}
            />
          </div>

          {pipelineDealMode === "existing" ? (
            <div className="form space-y-4">
              <div className="form-field">
                <label htmlFor="existing_customer">Existing customer</label>
                <select
                  id="existing_customer"
                  value={selectedExistingCustomerId}
                  onChange={(e) => setSelectedExistingCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Select customer…</option>
                  {existingCustomers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Opens the sales pipeline form in <strong>Old pipeline</strong> mode
                  so you can advance the existing deal.
                </p>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleContinueExistingCustomer}
                  disabled={!selectedExistingCustomerId}
                >
                  Continue existing pipeline
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="mb-6 pb-6 border-b border-slate-200">
            <CompanyContactSearchPanel
              variant="light"
              initialCompany={form.customer_name}
              onUseCrmCustomer={(customer) => {
                setPipelineDealMode("existing");
                setSelectedExistingCustomerId(customer.customer_id);
                setError(null);
              }}
            />
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="customer_name">Customer name</label>
              <input
                id="customer_name"
                type="text"
                value={form.customer_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, customer_name: e.target.value }))
                }
                placeholder="e.g. Sika Abyssinia Chemicals PLC"
              />
            </div>

            <div className="form-field">
              <label htmlFor="initial_pipeline_stage">
                First sales pipeline stage
              </label>
              <select
                id="initial_pipeline_stage"
                value={form.initial_pipeline_stage}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    initial_pipeline_stage: e.target.value as InitialPipelineStage,
                  }))
                }
              >
                <option value="Lead ID">Lead ID (default)</option>
                <option value="Discovery">Discovery</option>
                <option value="Sample">Sample</option>
              </select>
              <p className="text-xs text-slate-500 mt-1" style={{ marginTop: "0.35rem" }}>
                Creates one company pipeline at this stage. Product deals are added
                separately in Sales — they will not duplicate this row.
              </p>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Create customer"}
              </button>
            </div>
          </form>
          </>
          )}
        </section>
      ) : (
        <>
          {/* Customer Created Successfully */}
          <section className="card">
            <h3>Customer Created</h3>
            <div style={{ marginBottom: "1rem" }}>
              <p>
                <strong>Name:</strong> {createdCustomer.customer_name}
              </p>
              <p>
                <strong>Display ID:</strong> {createdCustomer.display_id || "—"}
              </p>
            </div>

            {buildingProfile && (
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f0f9ff", borderRadius: "0.5rem", border: "1px solid #bae6fd" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "20px",
                      height: "20px",
                      border: "2px solid #2563eb",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span style={{ color: "#1e40af", fontWeight: "500" }}>
                    Building AI profile… This may take up to a minute.
                  </span>
                </div>
              </div>
            )}

            <div className="form-actions" style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
              {!profileResult && (
                <button
                  type="button"
                  onClick={() => void handleBuildProfile()}
                  disabled={buildingProfile}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: buildingProfile ? "#93c5fd" : "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    cursor: buildingProfile ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Sparkles size={18} />
                  {buildingProfile ? "Building AI profile…" : "Build AI profile"}
                </button>
              )}
              <button
                type="button"
                onClick={handleViewCustomer}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "transparent",
                  color: "#2563eb",
                  border: "2px solid #2563eb",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                View Customer Details
              </button>
            </div>
          </section>

          {/* Profile Results */}
          {profileResult && (
            <section className="card">
              <h3>AI Profile Generated</h3>
              <p className="section-description">
                The profile has been saved as an interaction. You can view it in the
                customer's interaction history.
              </p>

              {/* Strategic-Fit Matrix Scores */}
              {profileResult.product_alignment_scores &&
                Object.keys(profileResult.product_alignment_scores).length > 0 && (
                  <div style={{ marginTop: "1.5rem" }}>
                    <h4 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
                      Strategic-Fit Matrix
                    </h4>
                    <p className="section-description" style={{ marginBottom: "1rem" }}>
                      Product alignment scores (0 = No Fit, 1 = Low, 2 = Moderate, 3 = High Fit)
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "0.75rem",
                      }}
                    >
                      {Object.entries(profileResult.product_alignment_scores).map(
                        ([category, score]) => (
                          <div
                            key={category}
                            style={{
                              padding: "0.75rem",
                              backgroundColor: "#f9fafb",
                              borderRadius: "0.5rem",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.875rem",
                                color: "#6b7280",
                                marginBottom: "0.25rem",
                              }}
                            >
                              {category}
                            </div>
                            <div
                              style={{
                                fontSize: "1.5rem",
                                fontWeight: "bold",
                                color:
                                  score === 3
                                    ? "#10b981"
                                    : score === 2
                                    ? "#3b82f6"
                                    : score === 1
                                    ? "#f59e0b"
                                    : "#6b7280",
                              }}
                            >
                              {score}/3
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              <div className="form-actions" style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
                <button
                  type="button"
                  onClick={() => navigate(`/crm/customers/${createdCustomer.customer_id}/profile`)}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  View Full Profile
                </button>
                <button
                  type="button"
                  onClick={handleViewCustomer}
                  style={{
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "transparent",
                    color: "#2563eb",
                    border: "2px solid #2563eb",
                    borderRadius: "0.5rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  View Customer Details
                </button>
              </div>
            </section>
          )}
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}


