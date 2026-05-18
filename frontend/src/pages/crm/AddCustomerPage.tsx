import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Customer, Interaction } from "../../services/api";

interface CustomerFormState {
  customer_name: string;
}

export function AddCustomerPage() {
  const [form, setForm] = useState<CustomerFormState>({
    customer_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [profileResult, setProfileResult] = useState<Customer | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      };

      const res = await api.post<Customer>("/crm/customers", payload);
      const created = res.data;
      setCreatedCustomer(created);
      setSuccess("Customer created successfully! Auto-filling sales stage and building AI profile...");
      
      // Automatically auto-fill sales stage after creating customer
      try {
        const stageRes = await api.post<Customer>(`/crm/customers/${created.customer_id}/auto-fill-sales-stage`);
        setCreatedCustomer(stageRes.data); // Update with sales stage
        console.log("Sales stage auto-filled:", stageRes.data.sales_stage);
      } catch (stageErr: any) {
        console.error("Auto-fill sales stage error:", stageErr);
        // Don't show error - continue with profile building
      }
      
      // Automatically build profile after creating customer
      try {
        setBuildingProfile(true);
        setProfileError(null);
        console.log("Building profile for customer:", created.customer_id);
        const profileRes = await api.post<Customer>(
          `/crm/customers/${created.customer_id}/build-profile`
        );
        console.log("Profile build response:", profileRes.data);
        setProfileResult(profileRes.data);
        setSuccess("Customer created, sales stage auto-filled, and profile built successfully! The profile has been saved as an interaction.");
      } catch (profileErr: any) {
        console.error("Profile build error:", profileErr);
        console.error("Error response:", profileErr?.response?.data);
        const msg =
          profileErr?.response?.data?.detail ??
          profileErr?.message ??
          "Failed to build profile.";
        setProfileError(msg);
        setSuccess("Customer created and sales stage auto-filled successfully, but profile building failed. You can try building the profile later.");
      } finally {
        setBuildingProfile(false);
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
      const res = await api.post<Customer>(
        `/crm/customers/${createdCustomer.customer_id}/build-profile`
      );
      console.log("Profile build response:", res.data);
      setProfileResult(res.data);
      setSuccess("Profile built successfully! The profile has been saved as an interaction.");
    } catch (err: any) {
      console.error("Profile build error:", err);
      console.error("Error response:", err?.response?.data);
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Failed to build profile.";
      setProfileError(msg);
      // Show full error details in console for debugging
      if (err?.response?.data?.detail) {
        console.error("Full error detail:", err.response.data.detail);
      }
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

            <div className="form-actions">
              <button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Create customer"}
              </button>
            </div>
          </form>
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
                    Building AI profile... This may take a moment.
                  </span>
                </div>
              </div>
            )}

            <div className="form-actions" style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
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


