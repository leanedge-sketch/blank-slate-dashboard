import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  Customer,
  CustomerProfileFeedback,
  CustomerProfileUpdate,
  CustomerProfileFeedbackCreate,
  InteractionListResponse,
} from "../../services/api";
import { ProfileICPLayout } from "../../components/ProfileICPLayout";
import { ProfileResearchContext } from "../../components/ProfileResearchContext";
import { fetchAllCustomerInteractions } from "../../utils/interactions";
import type { Interaction } from "../../services/api";
import { mergeStrategicFitItems } from "../../utils/profileText";
import { Edit2, Save, X, Eye, Download, Star, RefreshCw } from "lucide-react";
import "./profile-icp.css";

export function CustomerProfilePage() {
  const { customerId } = useParams<{ customerId: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<CustomerProfileFeedback[]>([]);
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [creatingICP, setCreatingICP] = useState(false);
  const [latestInteraction, setLatestInteraction] = useState<string | null>(null);
  const [mergedInteractions, setMergedInteractions] = useState<Interaction[]>([]);
  const [interactionTotal, setInteractionTotal] = useState<number>(0);

  async function handleGenerateICP() {
    if (!customerId) return;
    try {
      setCreatingICP(true);
      console.log("Generating ICP for customer:", customerId);
      const res = await api.post<Customer>(`/crm/customers/${customerId}/build-profile`);
      console.log("ICP creation response:", res.data);

      // Always re-fetch the customer after build-profile so the UI reflects the latest DB state.
      const refreshed = await api.get<Customer>(`/crm/customers/${customerId}`);
      console.log("Customer after ICP refresh:", refreshed.data);

      setCustomer(refreshed.data);
      setEditedProfile(refreshed.data.latest_profile_text || "");
      setLatestInteraction(null);
      try {
        const bundle = await fetchAllCustomerInteractions(customerId);
        setInteractionTotal(bundle.total);
        setMergedInteractions(bundle.interactions);
      } catch {
        /* keep prior live history */
      }
    } catch (err: any) {
      console.error("Failed to create/regenerate ICP profile:", err);
      const errorMsg = err?.response?.data?.detail ?? err?.message ?? "Failed to create/regenerate ICP profile";
      console.error("Error details:", errorMsg);
      alert(errorMsg);
    } finally {
      setCreatingICP(false);
    }
  }

  async function fetchCustomerAndProfile() {
    if (!customerId) return;
    try {
      setLoading(true);
      setError(null);

      const customerRes = await api.get<Customer>(`/crm/customers/${customerId}`);
      setCustomer(customerRes.data);
      const profileText = customerRes.data.latest_profile_text || "";
      setEditedProfile(profileText);

      // If no profile text, try to fetch latest interaction as fallback
      if (!profileText) {
        try {
          const interactionsRes = await api.get<InteractionListResponse>(
            `/crm/customers/${customerId}/interactions`,
            { params: { limit: 1, offset: 0 } },
          );
          // Handle InteractionListResponse format
          const interactions = interactionsRes.data?.interactions || [];
          if (interactions.length > 0) {
            const latest = interactions[0];
            const fallbackText = latest.ai_response || latest.input_text || null;
            if (fallbackText) {
              setLatestInteraction(fallbackText);
            }
          }
        } catch (err: any) {
          console.warn("Could not fetch interactions:", err?.response?.data || err?.message);
        }
      }

      try {
        const bundle = await fetchAllCustomerInteractions(customerId);
        setInteractionTotal(bundle.total);
        setMergedInteractions(bundle.interactions);
      } catch (err: any) {
        console.warn("Could not fetch all interactions for profile:", err?.response?.data || err?.message);
        setMergedInteractions([]);
        setInteractionTotal(0);
      }

      // Fetch recent feedback (optional - fails gracefully if table doesn't exist)
      try {
        const feedbackRes = await api.get<CustomerProfileFeedback[]>(
          `/crm/customers/${customerId}/profile/feedback`,
          { params: { limit: 10 } }
        );
        setFeedback(feedbackRes.data);
      } catch (err: any) {
        // Feedback is optional - if table doesn't exist, just use empty array
        console.warn("Could not fetch feedback (table may not exist):", err?.response?.data || err?.message);
        setFeedback([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail ?? err?.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCustomerAndProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleSave() {
    if (!customerId) return;

    try {
      setSaving(true);
      const update: CustomerProfileUpdate = {
        profile_text: editedProfile,
      };

      const res = await api.put<Customer>(
        `/crm/customers/${customerId}/profile`,
        update
      );

      setCustomer(res.data);
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (customer?.latest_profile_text) {
      setEditedProfile(customer.latest_profile_text);
    }
    setIsEditing(false);
  }

  async function handleDownload() {
    if (!customerId) return;
    try {
      const res = await api.get(`/crm/customers/${customerId}/profile/download`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeName = customer?.customer_name || "customer_profile";
      link.download = `${safeName.replace(/\s+/g, "_")}_profile.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Failed to download profile:", err);
      alert("Failed to download profile as text.");
    }
  }

  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    try {
      setSubmittingFeedback(true);
      const body: CustomerProfileFeedbackCreate = {
        rating,
        comment: comment.trim() || undefined,
      };
      const res = await api.post<CustomerProfileFeedback>(
        `/crm/customers/${customerId}/profile/feedback`,
        body
      );
      setFeedback((prev) => [res.data, ...prev]);
      setComment("");
    } catch (err: any) {
      console.error("Failed to submit feedback:", err);
      alert(err?.response?.data?.detail ?? err?.message ?? "Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="info-banner">Loading profile...</div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="page">
        <div className="error-banner">{error ?? "Customer not found"}</div>
        <div style={{ marginTop: "1rem" }}>
          <Link to="/crm/customers">&larr; Back to ICP Workspace</Link>
        </div>
      </div>
    );
  }

  // If no profile exists yet AND we don't even have a latest interaction, show the empty state
  if (!customer.latest_profile_text && !latestInteraction) {
    return (
      <div className="page">
        <div className="page-header" style={{ marginBottom: "2rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.5rem" }}>{customer.customer_name}</h2>
            <p className="page-subtitle">
              Display ID: {customer.display_id ?? "—"} • No ICP profile yet
            </p>
          </div>
          <Link
            to="/crm/customers"
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "transparent",
              color: "#2563eb",
              border: "2px solid #2563eb",
              borderRadius: "0.5rem",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            ← Back to ICP Workspace
          </Link>
        </div>

        <section className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>No ICP Profile Yet</h3>
          <p style={{ marginBottom: "2rem", color: "#6b7280" }}>
            This customer doesn't have an Ideal Customer Profile yet. Click the button below to generate one using AI, or it will be automatically generated when interactions are logged.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleGenerateICP}
              disabled={creatingICP}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: creatingICP ? "#94a3b8" : "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: "600",
                cursor: creatingICP ? "not-allowed" : "pointer",
              }}
            >
              {creatingICP ? "Creating ICP..." : "Create ICP"}
            </button>
            <Link
              to="/crm/customers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#f3f4f6",
                color: "#374151",
                borderRadius: "0.5rem",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              ← Back to ICP Workspace
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // Decide what text to show as the ICP content:
  // 1) Prefer the saved latest_profile_text from the customer
  // 2) If that's empty, fall back to the latest interaction content (so you always see something)
  const effectiveProfileText =
    customer.latest_profile_text && customer.latest_profile_text.trim().length > 0
      ? customer.latest_profile_text
      : latestInteraction || "";

  const strategicFitItems = mergeStrategicFitItems(
    customer.product_alignment_scores,
    effectiveProfileText,
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: "2rem" }}>
        <div>
          <h2 style={{ marginBottom: "0.5rem" }}>{customer.customer_name}</h2>
          <p className="page-subtitle">
            Display ID: {customer.display_id ?? "—"} • Last updated:{" "}
            {customer.latest_profile_updated_at
              ? new Date(customer.latest_profile_updated_at).toLocaleDateString()
              : "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {!isEditing ? (
            <>
              <button
                type="button"
                onClick={handleGenerateICP}
                disabled={creatingICP}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: creatingICP ? "#94a3b8" : "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: creatingICP ? "not-allowed" : "pointer",
                }}
              >
                <RefreshCw size={18} />
                {creatingICP ? "Regenerating..." : "Regenerate ICP"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
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
                <Edit2 size={18} />
                Edit Profile
              </button>
              <Link
                to="/crm/customers"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "transparent",
                  color: "#2563eb",
                  border: "2px solid #2563eb",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                ← Back to ICP Workspace
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: saving ? "#94a3b8" : "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                <Save size={18} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "transparent",
                  color: "#6b7280",
                  border: "2px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontWeight: "600",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                <X size={18} />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <section className="card" style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <h3>Edit Ideal Customer Profile</h3>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                color: "#6b7280",
              }}
            >
              <Eye size={16} />
              Raw text editor
            </span>
          </div>
          <textarea
            value={editedProfile}
            onChange={(e) => setEditedProfile(e.target.value)}
            style={{
              width: "100%",
              minHeight: "min(70vh, 800px)",
              maxHeight: "800px",
              padding: "1.5rem",
              fontSize: "0.95rem",
              lineHeight: 1.75,
              fontFamily: "ui-monospace, monospace",
              border: "2px solid #e5e7eb",
              borderRadius: "0.5rem",
              resize: "vertical",
              overflowY: "auto",
            }}
            placeholder="Edit the profile content..."
          />
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
            Supports large profiles (100k+ characters). Save to update the structured view.
          </p>
        </section>
      ) : (
        <div className="profile-icp-page">
          <ProfileResearchContext meta={customer.latest_profile_research_meta} />
          {interactionTotal > 0 ? (
            <p
              style={{
                margin: "0 0 1rem",
                fontSize: "0.9rem",
                color: "#059669",
                fontWeight: 500,
              }}
            >
              Connected to Supabase — {interactionTotal} merged history row
              {interactionTotal === 1 ? "" : "s"} (interactions table + pipeline)
              {customer.latest_profile_research_meta?.crm_interaction_count != null
                ? ` · ${customer.latest_profile_research_meta.crm_interaction_count} in interactions table for last ICP build`
                : ""}
              . Regenerate ICP to include May and legacy logs in analysis.
            </p>
          ) : null}
          <ProfileICPLayout
            text={effectiveProfileText}
            strategicFitItems={strategicFitItems}
            researchMeta={customer.latest_profile_research_meta}
            mergedInteractions={mergedInteractions}
          />
        </div>
      )}

      {/* Download and Feedback Section */}
      <section className="card" style={{ marginTop: "2rem" }}>
        <h3 style={{ marginBottom: "1.5rem" }}>Actions</h3>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <Download size={18} />
            Download as .txt
          </button>
          <Link
            to="/crm/customers"
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              borderRadius: "0.5rem",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            ← Back to ICP Workspace
          </Link>
        </div>

        {/* Feedback Form */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "2rem" }}>
          <h4 style={{ marginBottom: "1rem" }}>Rate & Comment on this ICP</h4>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem" }}>
            Your feedback helps improve future AI-generated profiles.
          </p>
          <form onSubmit={handleSubmitFeedback}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Rating (1-5 stars)
              </label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0.25rem",
                    }}
                  >
                    <Star
                      size={24}
                      fill={star <= rating ? "#fbbf24" : "none"}
                      stroke={star <= rating ? "#fbbf24" : "#d1d5db"}
                      style={{ transition: "all 0.2s" }}
                    />
                  </button>
                ))}
                <span style={{ marginLeft: "0.5rem", color: "#6b7280", fontSize: "0.875rem" }}>
                  {rating}/5
                </span>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What was good? What should be improved?"
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  resize: "vertical",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submittingFeedback}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: submittingFeedback ? "#94a3b8" : "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: "600",
                cursor: submittingFeedback ? "not-allowed" : "pointer",
              }}
            >
              {submittingFeedback ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>

          {/* Recent Feedback */}
          {feedback.length > 0 && (
            <div style={{ marginTop: "2rem", borderTop: "1px solid #e5e7eb", paddingTop: "2rem" }}>
              <h4 style={{ marginBottom: "1rem" }}>Recent Feedback</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {feedback.map((fb) => (
                  <div
                    key={fb.id}
                    style={{
                      padding: "1rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.5rem",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          fill={star <= fb.rating ? "#fbbf24" : "none"}
                          stroke={star <= fb.rating ? "#fbbf24" : "#d1d5db"}
                        />
                      ))}
                      <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "0.5rem" }}>
                        {fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    {fb.comment && (
                      <p style={{ fontSize: "0.875rem", color: "#374151", marginTop: "0.5rem" }}>
                        {fb.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

