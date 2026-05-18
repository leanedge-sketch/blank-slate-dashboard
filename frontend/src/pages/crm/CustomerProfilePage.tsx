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
import { Edit2, Save, X, Eye, Download, Star, RefreshCw } from "lucide-react";

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
      setLatestInteraction(null); // Clear fallback since we now have a profile
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
          const interactionsRes = await api.get<InteractionListResponse>(`/crm/customers/${customerId}/interactions`, {
            params: { limit: 1, offset: 0 },
          });
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

  // Clean and format profile text for beautiful display
  function formatProfileForDisplay(text: string): JSX.Element {
    // Remove JSON block at the end if present
    let cleanText = text
      .replace(/```json[\s\S]*?```/g, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\{[\s\S]*"strategic_fit_matrix"[\s\S]*\}/g, "");
    
    // Remove markdown tables more aggressively - find all table blocks
    cleanText = cleanText.replace(/\n\|[\s\S]*?\|\n/g, (match) => {
      const lines = match.split("\n").filter(l => l.trim() && l.includes("|"));
      if (lines.length < 2) return "";
      
      // Skip header separator lines (---)
      const dataLines = lines.filter(l => !l.match(/^\|[\s\s]*:?-+:?[\s\s]*\|/));
      
      if (dataLines.length === 0) return "";
      
      // Convert first line to headers if it looks like headers
      const headers = dataLines[0].split("|").filter(c => c.trim()).map(c => c.trim());
      const rows = dataLines.slice(1);
      
      // Convert to readable format
      const converted = rows.map(row => {
        const cells = row.split("|").filter(c => c.trim()).map(c => c.trim());
        if (cells.length === 0) return "";
        // Format as "Header: Value" pairs
        return cells.map((cell, i) => {
          if (i < headers.length && headers[i] && cell && cell !== "N/A") {
            return `${headers[i]}: ${cell}`;
          }
          return cell;
        }).filter(c => c && !c.includes(":---")).join(" • ");
      }).filter(r => r && !r.match(/^N\/A/)).join("\n");
      
      return converted ? "\n" + converted + "\n" : "";
    });
    
    // Remove markdown bold/italic (**text**, *text*)
    cleanText = cleanText.replace(/\*\*([^*]+)\*\*/g, "$1");
    cleanText = cleanText.replace(/\*([^*]+)\*/g, "$1");
    
    // Remove markdown links [text](url) -> text (url)
    cleanText = cleanText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
    
    // Remove citations [1], [2], etc.
    cleanText = cleanText.replace(/\[\d+\]/g, "");
    
    // Split into sections by ## headers OR numbered headings
    const sectionPattern = /\n(?:##\s+|(\d+\.\s+))([^\n]+)/g;
    const sections: Array<{ title: string; content: string }> = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sectionPattern.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        const prevContent = cleanText.substring(lastIndex, match.index).trim();
        if (prevContent) {
          if (sections.length === 0) {
            sections.push({ title: "", content: prevContent });
          } else {
            sections[sections.length - 1].content += "\n\n" + prevContent;
          }
        }
      }
      const title = match[2].trim();
      lastIndex = match.index + match[0].length;
      sections.push({ title, content: "" });
    }
    
    // Add remaining content
    if (lastIndex < cleanText.length) {
      const remaining = cleanText.substring(lastIndex).trim();
      if (remaining) {
        if (sections.length === 0) {
          sections.push({ title: "", content: remaining });
        } else {
          sections[sections.length - 1].content += "\n\n" + remaining;
        }
      }
    }
    
    // If no sections found, treat entire text as one section
    if (sections.length === 0) {
      sections.push({ title: "", content: cleanText });
    }
    
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {sections.map((section, idx) => {
          if (!section.content.trim()) return null;
          
          const lines = section.content.split("\n").filter(l => l.trim());
          
          return (
            <div
              key={idx}
              style={{
                padding: "2rem",
                backgroundColor: "#ffffff",
                borderRadius: "1rem",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
              }}
            >
              {section.title && (
                <h3
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "700",
                    color: "#111827",
                    marginBottom: "1.5rem",
                    paddingBottom: "1rem",
                    borderBottom: "3px solid #3b82f6",
                  }}
                >
                  {section.title}
                </h3>
              )}
              <div style={{ lineHeight: "1.9", color: "#374151" }}>
                {lines.map((line, lineIdx) => {
                  const trimmed = line.trim();
                  
                  // Format numbered lists (1., 2., etc.)
                  if (trimmed.match(/^\d+\.\s+/)) {
                    const content = trimmed.replace(/^\d+\.\s+/, "");
                    return (
                      <div
                        key={lineIdx}
                        style={{
                          marginLeft: "1.5rem",
                          marginBottom: "1rem",
                          paddingLeft: "1rem",
                          padding: "0.75rem",
                          backgroundColor: "#f9fafb",
                          borderRadius: "0.5rem",
                          borderLeft: "4px solid #3b82f6",
                        }}
                      >
                        <strong style={{ color: "#1e40af" }}>
                          {trimmed.match(/^\d+\./)?.[0]}
                        </strong>{" "}
                        {content}
                      </div>
                    );
                  }
                  
                  // Format bullet points
                  if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
                    return (
                      <div
                        key={lineIdx}
                        style={{
                          marginLeft: "1.5rem",
                          marginBottom: "0.75rem",
                          paddingLeft: "1rem",
                          borderLeft: "3px solid #10b981",
                        }}
                      >
                        {trimmed.substring(1).trim()}
                      </div>
                    );
                  }
                  
                  // Format strategic fit lines (Category: score/3)
                  if (trimmed.match(/:\s*\d+\/3/)) {
                    const parts = trimmed.split(":");
                    if (parts.length >= 2) {
                      const category = parts[0].trim();
                      const rest = parts.slice(1).join(":").trim();
                      const scoreMatch = rest.match(/(\d+)\/3/);
                      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
                      const reason = rest.replace(/\d+\/3\s*[-–]\s*/, "").trim();
                      
                      return (
                        <div
                          key={lineIdx}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "1rem",
                            marginBottom: "1rem",
                            padding: "1rem",
                            backgroundColor: score >= 2 ? "#ecfdf5" : score === 1 ? "#fffbeb" : "#f9fafb",
                            borderRadius: "0.75rem",
                            border: `2px solid ${
                              score === 3
                                ? "#10b981"
                                : score === 2
                                ? "#3b82f6"
                                : score === 1
                                ? "#f59e0b"
                                : "#e5e7eb"
                            }`,
                          }}
                        >
                          <span style={{ fontWeight: "700", minWidth: "180px", color: "#111827" }}>
                            {category}:
                          </span>
                          <span
                            style={{
                              fontSize: "1.5rem",
                              fontWeight: "800",
                              color:
                                score === 3
                                  ? "#10b981"
                                  : score === 2
                                  ? "#3b82f6"
                                  : score === 1
                                  ? "#f59e0b"
                                  : "#9ca3af",
                              minWidth: "70px",
                            }}
                          >
                            {score}/3
                          </span>
                          {reason && (
                            <span style={{ color: "#6b7280", flex: 1, fontSize: "0.95rem" }}>
                              {reason}
                            </span>
                          )}
                        </div>
                      );
                    }
                  }
                  
                  // Format contact lines (Name:, Position:, LinkedIn:)
                  if (trimmed.match(/^(Name|Position|LinkedIn):/i)) {
                    return (
                      <div
                        key={lineIdx}
                        style={{
                          marginBottom: "0.5rem",
                          padding: "0.5rem 0",
                          fontSize: "0.95rem",
                        }}
                      >
                        <strong style={{ color: "#374151" }}>
                          {trimmed.split(":")[0]}:
                        </strong>{" "}
                        <span style={{ color: "#6b7280" }}>
                          {trimmed.split(":").slice(1).join(":").trim()}
                        </span>
                      </div>
                    );
                  }
                  
                  // Regular paragraph
                  if (trimmed) {
                    return (
                      <p
                        key={lineIdx}
                        style={{
                          marginBottom: "1.25rem",
                          fontSize: "1rem",
                          lineHeight: "1.8",
                        }}
                      >
                        {trimmed}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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

      {/* Strategic-Fit Matrix (if available) */}
      {customer.product_alignment_scores &&
        Object.keys(customer.product_alignment_scores).length > 0 && (
          <section
            className="card"
            style={{
              marginBottom: "2rem",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
            }}
          >
            <h3 style={{ color: "white", marginBottom: "1.5rem" }}>Strategic-Fit Matrix</h3>
            <p style={{ marginBottom: "1rem", opacity: 0.9 }}>
              Product alignment scores (0 = No Fit, 1 = Low, 2 = Moderate, 3 = High Fit)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {Object.entries(customer.product_alignment_scores).map(([category, score]) => (
                <div
                  key={category}
                  style={{
                    padding: "1.25rem",
                    backgroundColor: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(10px)",
                    borderRadius: "0.75rem",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      opacity: 0.9,
                      marginBottom: "0.5rem",
                      fontWeight: "500",
                    }}
                  >
                    {category}
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: "bold",
                      color:
                        score === 3
                          ? "#10b981"
                          : score === 2
                          ? "#3b82f6"
                          : score === 1
                          ? "#f59e0b"
                          : "#9ca3af",
                    }}
                  >
                    {score}/3
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      {/* Profile Content */}
      <section className="card" style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <h3>AI-Generated Profile</h3>
          {!isEditing && (
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
              View Mode
            </span>
          )}
        </div>

        {isEditing ? (
          <div>
            <textarea
              value={editedProfile}
              onChange={(e) => setEditedProfile(e.target.value)}
              style={{
                width: "100%",
                minHeight: "600px",
                padding: "1.5rem",
                fontSize: "1rem",
                lineHeight: "1.75",
                fontFamily: "monospace",
                border: "2px solid #e5e7eb",
                borderRadius: "0.5rem",
                resize: "vertical",
              }}
              placeholder="Edit the profile content..."
            />
            <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
              Make your edits above, then click "Save Changes" to update the profile.
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: "0",
            }}
          >
            {formatProfileForDisplay(effectiveProfileText)}
          </div>
        )}
      </section>

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

