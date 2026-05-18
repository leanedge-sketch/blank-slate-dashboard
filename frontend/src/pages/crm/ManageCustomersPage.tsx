import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Customer, CustomerListResponse, CustomerUpdate } from "../../services/api";
import { Plus, Edit2, Trash2, X, Save, Search, Sparkles } from "lucide-react";

// Sales stage definitions
const SALES_STAGES: { [key: string]: string } = {
  "1": "Prospecting",
  "2": "Rapport",
  "3": "Needs Analysis",
  "4": "Presenting Solution",
  "5": "Handling Objections",
  "6": "Closing",
  "7": "Follow-up & Cross-sell",
};

export function ManageCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(1000); // Max limit allowed by backend is 1000
  const [offset, setOffset] = useState(0);

  // Add customer state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newDisplayId, setNewDisplayId] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newLinkedinUrl, setNewLinkedinUrl] = useState("");
  const [newPrimaryContactName, setNewPrimaryContactName] = useState("");
  const [newPrimaryContactEmail, setNewPrimaryContactEmail] = useState("");
  const [newPrimaryContactPhone, setNewPrimaryContactPhone] = useState("");
  const [adding, setAdding] = useState(false);
  
  // Build profile state
  const [buildingProfile, setBuildingProfile] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Edit customer state
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDisplayId, setEditDisplayId] = useState("");
  const [editSalesStage, setEditSalesStage] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editLinkedinUrl, setEditLinkedinUrl] = useState("");
  const [editPrimaryContactName, setEditPrimaryContactName] = useState("");
  const [editPrimaryContactEmail, setEditPrimaryContactEmail] = useState("");
  const [editPrimaryContactPhone, setEditPrimaryContactPhone] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Auto-fill sales stage state (per customer)
  const [autoFilling, setAutoFilling] = useState<string | null>(null);
  

  // Delete customer state
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchCustomers(query?: string, newOffset?: number, newLimit?: number) {
    try {
      setLoading(true);
      setError(null);

      const currentLimit = newLimit ?? limit;
      const currentOffset = newOffset ?? offset;
      
      // Cap limit at 1000 to avoid backend validation errors
      const safeLimit = Math.min(currentLimit, 1000);
      
      const params: Record<string, string | number> = { 
        limit: safeLimit, 
        offset: currentOffset 
      };
      if (query && query.trim().length > 0) {
        params.q = query.trim();
      }

      const res = await api.get<CustomerListResponse>("/crm/customers", {
        params,
      });
      setCustomers(res.data.customers);
      setTotal(res.data.total);
      setOffset(currentOffset);
      setLimit(safeLimit);
    } catch (err: any) {
      console.error(err);
      // Handle validation errors (422) from FastAPI
      let errorMessage = "Failed to load customers";
      if (err?.response?.status === 422) {
        const validationErrors = err?.response?.data?.detail;
        if (Array.isArray(validationErrors)) {
          errorMessage = validationErrors.map((e: any) => {
            if (typeof e === "string") return e;
            if (typeof e === "object" && e !== null) {
              return e.msg || e.message || JSON.stringify(e);
            }
            return String(e);
          }).join(", ");
        } else if (typeof validationErrors === "string") {
          errorMessage = validationErrors;
        } else if (validationErrors && typeof validationErrors === "object") {
          errorMessage = validationErrors.msg || validationErrors.message || JSON.stringify(validationErrors);
        } else {
          errorMessage = "Validation error: Invalid request parameters (limit must be ≤ 1000)";
        }
      } else {
        const detail = err?.response?.data?.detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (detail && typeof detail === "object") {
          errorMessage = detail.msg || detail.message || JSON.stringify(detail);
        } else {
          errorMessage = err?.message || "Failed to load customers";
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchCustomers(search);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      alert("Customer name is required");
      return;
    }

    try {
      setAdding(true);
      setProfileError(null);
      const res = await api.post<Customer>("/crm/customers", {
        customer_name: newCustomerName.trim(),
        display_id: newDisplayId.trim() || undefined,
        website_url: newWebsiteUrl.trim() || undefined,
        linkedin_company_url: newLinkedinUrl.trim() || undefined,
        primary_contact_name: newPrimaryContactName.trim() || undefined,
        primary_contact_email: newPrimaryContactEmail.trim() || undefined,
        primary_contact_phone: newPrimaryContactPhone.trim() || undefined,
      });

      setCustomers((prev) => [res.data, ...prev]);
      setTotal((prev) => prev + 1);
      setNewCustomerName("");
      setNewDisplayId("");
      setNewWebsiteUrl("");
      setNewLinkedinUrl("");
      setNewPrimaryContactName("");
      setNewPrimaryContactEmail("");
      setNewPrimaryContactPhone("");
      setShowAddForm(false);
      
      // Automatically auto-fill sales stage after creating customer
      try {
        setAutoFilling(res.data.customer_id);
        console.log("Auto-filling sales stage for customer:", res.data.customer_id);
        const stageRes = await api.post<Customer>(`/crm/customers/${res.data.customer_id}/auto-fill-sales-stage`);
        console.log("Auto-fill sales stage response:", stageRes.data);
        // Update the customer in the list with the new sales stage
        setCustomers((prev) =>
          prev.map((c) => (c.customer_id === res.data.customer_id ? stageRes.data : c))
        );
      } catch (stageErr: any) {
        console.error("Auto-fill sales stage error:", stageErr);
        console.error("Error details:", stageErr?.response?.data);
        // Don't show alert if it fails - it's automatic, but log it
      } finally {
        setAutoFilling(null);
      }
      
      // Automatically build profile after creating customer (silently in background)
      handleBuildProfile(res.data.customer_id).catch(err => {
        console.error("Profile building failed:", err);
        // Silently fail - don't show error to user
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to create customer");
    } finally {
      setAdding(false);
    }
  }

  async function handleBuildProfile(customerId: string) {
    try {
      setBuildingProfile(customerId);
      setProfileError(null);
      console.log("Building profile for customer:", customerId);
      const res = await api.post<Customer>(`/crm/customers/${customerId}/build-profile`);
      console.log("Profile build response:", res.data);
      // Update the customer in the list with the new profile data
      setCustomers((prev) =>
        prev.map((c) => (c.customer_id === customerId ? res.data : c))
      );
      // Don't show alert if called automatically after creation
      if (!adding) {
        alert("Profile built successfully! The profile has been saved as an interaction.");
      }
    } catch (err: any) {
      console.error("Profile build error:", err);
      console.error("Error response:", err?.response?.data);
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Failed to build profile.";
      setProfileError(msg);
      // Only show alert if not called automatically (user clicked button manually)
      if (!adding) {
        alert(msg);
      }
    } finally {
      setBuildingProfile(null);
    }
  }

  function startEdit(customer: Customer) {
    setEditingCustomer(customer.customer_id);
    setEditName(customer.customer_name);
    setEditDisplayId(customer.display_id || "");
    setEditSalesStage(customer.sales_stage || "1");
    setEditWebsiteUrl(customer.website_url || "");
    setEditLinkedinUrl(customer.linkedin_company_url || "");
    setEditPrimaryContactName(customer.primary_contact_name || "");
    setEditPrimaryContactEmail(customer.primary_contact_email || "");
    setEditPrimaryContactPhone(customer.primary_contact_phone || "");
  }

  function cancelEdit() {
    setEditingCustomer(null);
    setEditName("");
    setEditDisplayId("");
    setEditSalesStage("1");
    setEditWebsiteUrl("");
    setEditLinkedinUrl("");
    setEditPrimaryContactName("");
    setEditPrimaryContactEmail("");
    setEditPrimaryContactPhone("");
  }

  async function saveEdit(customerId: string) {
    try {
      setSaving(true);
      const update: CustomerUpdate = {
        customer_name: editName.trim() || undefined,
        display_id: editDisplayId.trim() || undefined,
        sales_stage: editSalesStage || undefined,
        website_url: editWebsiteUrl.trim() || undefined,
        linkedin_company_url: editLinkedinUrl.trim() || undefined,
        primary_contact_name: editPrimaryContactName.trim() || undefined,
        primary_contact_email: editPrimaryContactEmail.trim() || undefined,
        primary_contact_phone: editPrimaryContactPhone.trim() || undefined,
      };

      const res = await api.put<Customer>(`/crm/customers/${customerId}`, update);
      setCustomers((prev) =>
        prev.map((c) => (c.customer_id === customerId ? res.data : c))
      );
      cancelEdit();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }
  
  async function handleAutoFillSalesStage(customerId: string) {
    try {
      setAutoFilling(customerId);
      const res = await api.post<Customer>(`/crm/customers/${customerId}/auto-fill-sales-stage`);
      // Update the customer in the list
      setCustomers((prev) =>
        prev.map((c) => (c.customer_id === customerId ? res.data : c))
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to auto-fill sales stage");
    } finally {
      setAutoFilling(null);
    }
  }

  async function handleDelete(customerId: string, customerName: string) {
    if (!confirm(`Are you sure you want to delete "${customerName}"? This will also delete all associated interactions.`)) {
      return;
    }

    try {
      setDeleting(customerId);
      await api.delete(`/crm/customers/${customerId}`);
      setCustomers((prev) => prev.filter((c) => c.customer_id !== customerId));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to delete customer");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Manage Customers</h2>
          <p className="page-subtitle">
            Add, edit, and delete customers. Search by customer name.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {!showAddForm ? (
            <>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <Plus size={18} />
                Add Customer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewCustomerName("");
                setNewDisplayId("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "transparent",
                color: "#6b7280",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              <X size={18} />
              Cancel
            </button>
          )}
          <Link to="/crm">Back to CRM</Link>
        </div>
      </div>

      {/* Add Customer Form */}
      {showAddForm && (
        <section className="card" style={{ marginBottom: "2rem" }}>
          <h3>Add New Customer</h3>
          <form onSubmit={handleAddCustomer}>
            <div className="form-field">
              <label htmlFor="new_customer_name">Customer Name *</label>
              <input
                id="new_customer_name"
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="e.g. Sika Abyssinia Chemicals PLC"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_display_id">
                Display ID{" "}
                <span className="muted">(optional – will auto-generate if left blank)</span>
              </label>
              <input
                id="new_display_id"
                type="text"
                value={newDisplayId}
                onChange={(e) => setNewDisplayId(e.target.value)}
                placeholder="e.g. LC-2025-CUST-0001"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_website_url">
                Website URL <span className="muted">(optional)</span>
              </label>
              <input
                id="new_website_url"
                type="url"
                value={newWebsiteUrl}
                onChange={(e) => setNewWebsiteUrl(e.target.value)}
                placeholder="e.g. https://www.example.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_linkedin_url">
                LinkedIn Company URL <span className="muted">(optional)</span>
              </label>
              <input
                id="new_linkedin_url"
                type="url"
                value={newLinkedinUrl}
                onChange={(e) => setNewLinkedinUrl(e.target.value)}
                placeholder="e.g. https://www.linkedin.com/company/example"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_primary_contact_name">
                Primary Contact Name <span className="muted">(optional)</span>
              </label>
              <input
                id="new_primary_contact_name"
                type="text"
                value={newPrimaryContactName}
                onChange={(e) => setNewPrimaryContactName(e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_primary_contact_email">
                Primary Contact Email <span className="muted">(optional)</span>
              </label>
              <input
                id="new_primary_contact_email"
                type="email"
                value={newPrimaryContactEmail}
                onChange={(e) => setNewPrimaryContactEmail(e.target.value)}
                placeholder="e.g. john.doe@example.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="new_primary_contact_phone">
                Primary Contact Phone <span className="muted">(optional)</span>
              </label>
              <input
                id="new_primary_contact_phone"
                type="tel"
                value={newPrimaryContactPhone}
                onChange={(e) => setNewPrimaryContactPhone(e.target.value)}
                placeholder="e.g. +251 9XX XXX XXX"
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={adding || !newCustomerName.trim()}>
                {adding ? "Adding..." : "Add Customer"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search */}
      <section className="card" style={{ marginBottom: "2rem" }}>
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              size={20}
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
              }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name..."
              style={{
                width: "100%",
                padding: "0.75rem 0.75rem 0.75rem 2.5rem",
                border: "1px solid #d1d5db",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#374151",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Search
          </button>
        </form>
      </section>

      {loading && <div className="info-banner">Loading customers...</div>}
      {error && <div className="error-banner">{error}</div>}
      {profileError && <div className="error-banner">{profileError}</div>}
      {adding && buildingProfile && (
        <div className="info-banner">
          Creating customer and building AI profile... This may take a moment.
        </div>
      )}

      {/* Customers List */}
      <section className="card">
        <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            Showing {customers.length} / {total} customers
            {customers.length < total && (
              <span style={{ marginLeft: "0.5rem", color: "#ef4444" }}>
                (Limited to {limit} - increase limit to see more)
              </span>
            )}
          </div>
          {total > limit && (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  const newLimit = limit + 500;
                  fetchCustomers(search, 0, newLimit);
                }}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Load More (+500)
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchCustomers(search, 0, 1000);
                }}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Load All (Max 1000)
              </button>
            </div>
          )}
        </div>
        {customers.length === 0 && !loading ? (
          <p className="muted">No customers found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {customers.map((customer) => {
              const isEditing = editingCustomer === customer.customer_id;
              const isDeleting = deleting === customer.customer_id;

              return (
                <div
                  key={customer.customer_id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  {isEditing ? (
                    <div>
                      <div style={{ marginBottom: "1rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Customer Name *
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                          required
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Display ID
                        </label>
                        <input
                          type="text"
                          value={editDisplayId}
                          onChange={(e) => setEditDisplayId(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Website URL
                        </label>
                        <input
                          type="url"
                          value={editWebsiteUrl}
                          onChange={(e) => setEditWebsiteUrl(e.target.value)}
                          placeholder="https://www.example.com"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          LinkedIn Company URL
                        </label>
                        <input
                          type="url"
                          value={editLinkedinUrl}
                          onChange={(e) => setEditLinkedinUrl(e.target.value)}
                          placeholder="https://www.linkedin.com/company/example"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Primary Contact Name
                        </label>
                        <input
                          type="text"
                          value={editPrimaryContactName}
                          onChange={(e) => setEditPrimaryContactName(e.target.value)}
                          placeholder="John Doe"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Primary Contact Email
                        </label>
                        <input
                          type="email"
                          value={editPrimaryContactEmail}
                          onChange={(e) => setEditPrimaryContactEmail(e.target.value)}
                          placeholder="john.doe@example.com"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Primary Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={editPrimaryContactPhone}
                          onChange={(e) => setEditPrimaryContactPhone(e.target.value)}
                          placeholder="+251 9XX XXX XXX"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#374151",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Sales Stage
                        </label>
                        <select
                          value={editSalesStage}
                          onChange={(e) => setEditSalesStage(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                            backgroundColor: "white",
                          }}
                        >
                          {Object.entries(SALES_STAGES).map(([key, value]) => (
                            <option key={key} value={key}>
                              {key} - {value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.75rem",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          style={{
                            padding: "0.75rem 1.5rem",
                            backgroundColor: "transparent",
                            border: "1px solid #d1d5db",
                            borderRadius: "0.5rem",
                            color: "#374151",
                            fontWeight: "600",
                            cursor: saving ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <X size={18} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(customer.customer_id)}
                          disabled={saving || !editName.trim()}
                          style={{
                            padding: "0.75rem 1.5rem",
                            backgroundColor: saving ? "#94a3b8" : "#10b981",
                            border: "none",
                            borderRadius: "0.5rem",
                            color: "white",
                            fontWeight: "600",
                            cursor: saving ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <Save size={18} />
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: "1.125rem",
                            fontWeight: "600",
                            color: "#111827",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {customer.customer_name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#6b7280",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Display ID: {customer.display_id ?? "—"}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#6b7280",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Sales Stage:{" "}
                          <span style={{ fontWeight: "600", color: "#374151" }}>
                            {customer.sales_stage
                              ? `${customer.sales_stage} - ${SALES_STAGES[customer.sales_stage] || "Unknown"}`
                              : "Not set"}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#9ca3af",
                          }}
                        >
                          Created:{" "}
                          {customer.created_at
                            ? new Date(customer.created_at).toLocaleDateString()
                            : "—"}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Link
                          to={`/crm/customers/${customer.customer_id}`}
                          style={{
                            padding: "0.5rem 1rem",
                            backgroundColor: "#2563eb",
                            color: "white",
                            borderRadius: "0.5rem",
                            textDecoration: "none",
                            fontSize: "0.875rem",
                            fontWeight: "600",
                          }}
                        >
                          View Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(customer)}
                          style={{
                            padding: "0.5rem",
                            backgroundColor: "transparent",
                            border: "1px solid #e5e7eb",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            color: "#6b7280",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(customer.customer_id, customer.customer_name)
                          }
                          disabled={isDeleting}
                          style={{
                            padding: "0.5rem",
                            backgroundColor: "transparent",
                            border: "1px solid #e5e7eb",
                            borderRadius: "0.5rem",
                            cursor: isDeleting ? "not-allowed" : "pointer",
                            color: "#ef4444",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

