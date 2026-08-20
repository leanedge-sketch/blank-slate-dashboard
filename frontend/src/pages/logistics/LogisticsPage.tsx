import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Loader2,
  MapPinned,
  RefreshCw,
  Truck,
  X,
} from "lucide-react";
import {
  getLoopASupabase,
  isLoopASupabaseConfigured,
} from "../../lib/loopASupabase";
import { getApiOrigin } from "../../lib/api-base";
import {
  formatPoId,
  LOGISTICS_STAGES,
  type PurchaseOrderRow,
} from "../../types/purchaseOrder";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function LogisticsPage() {
  const configured = isLoopASupabaseConfigured();
  const [rows, setRows] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalPo, setModalPo] = useState<PurchaseOrderRow | null>(null);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const pushToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      setError(
        "Loop A Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getLoopASupabase();
      const { data, error: qErr } = await supabase
        .from("purchase_orders")
        .select(
          "id, po_number, rfq_id, buyer_email, current_stage, last_updated, created_at",
        )
        .order("last_updated", { ascending: false });
      if (qErr) throw qErr;
      setRows((data as PurchaseOrderRow[]) ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load purchase orders.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const openStageModal = (row: PurchaseOrderRow) => {
    setModalPo(row);
    setSelectedStage(row.current_stage || LOGISTICS_STAGES[0]);
    setError(null);
  };

  const confirmStageUpdate = async () => {
    if (!modalPo || !selectedStage) return;

    const poId = modalPo.id;
    const previous = modalPo;
    const optimisticUpdatedAt = new Date().toISOString();

    // Optimistic UI
    setRows((prev) =>
      prev.map((r) =>
        r.id === poId
          ? { ...r, current_stage: selectedStage, last_updated: optimisticUpdatedAt }
          : r,
      ),
    );
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`${getApiOrigin()}/api/po/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poId, stage: selectedStage }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        currentStage?: string;
        lastUpdated?: string;
        detail?: string | unknown;
        error?: string;
      };

      if (!res.ok || data.success === false) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.error || "Failed to update purchase order stage.";
        throw new Error(detail);
      }

      setRows((prev) =>
        prev.map((r) =>
          r.id === poId
            ? {
                ...r,
                current_stage: data.currentStage || selectedStage,
                last_updated: data.lastUpdated || optimisticUpdatedAt,
              }
            : r,
        ),
      );
      setModalPo(null);
      pushToast(`Stage updated to ${data.currentStage || selectedStage}`);
    } catch (err) {
      // Roll back optimistic change
      setRows((prev) => prev.map((r) => (r.id === poId ? previous : r)));
      const msg =
        err instanceof Error ? err.message : "Failed to update stage.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rfq-page logistics-page">
      <div className="page-header rfq-page-header">
        <div>
          <p className="rfq-kicker">Loop C · Corridor tracking</p>
          <h2>Logistics</h2>
          <p className="section-description">
            Manage active purchase orders on the Djibouti–Modjo–Addis pipeline.
            Stage changes notify the buyer by email.
          </p>
        </div>
        <button
          type="button"
          className="rfq-refresh-btn"
          onClick={() => void loadOrders()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="rfq-icon spin" aria-hidden />
          ) : (
            <RefreshCw className="rfq-icon" aria-hidden />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rfq-alert" role="alert">
          <AlertCircle className="rfq-icon" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="rfq-table-wrap">
        {loading && rows.length === 0 ? (
          <div className="rfq-empty">
            <Loader2 className="rfq-icon spin" aria-hidden />
            Loading purchase orders…
          </div>
        ) : rows.length === 0 ? (
          <div className="rfq-empty">
            <Truck className="rfq-icon" aria-hidden />
            No purchase orders yet. Apply the Loop C migration to seed demo POs.
          </div>
        ) : (
          <table className="rfq-table">
            <thead>
              <tr>
                <th>PO ID</th>
                <th>RFQ ID</th>
                <th>Buyer Email</th>
                <th>Current Stage</th>
                <th>Last Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{formatPoId(row)}</strong>
                  </td>
                  <td>
                    <code className="logistics-mono">
                      {row.rfq_id ? row.rfq_id.slice(0, 8) : "—"}
                    </code>
                  </td>
                  <td>
                    <a href={`mailto:${row.buyer_email}`}>{row.buyer_email}</a>
                  </td>
                  <td>
                    <span className="logistics-stage-badge">
                      <MapPinned className="rfq-icon" aria-hidden />
                      {row.current_stage}
                    </span>
                  </td>
                  <td>{formatDate(row.last_updated)}</td>
                  <td>
                    <button
                      type="button"
                      className="rfq-action-btn logistics-update-btn"
                      onClick={() => openStageModal(row)}
                    >
                      Update Stage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalPo ? (
        <div className="rfq-modal-root" role="presentation">
          <button
            type="button"
            className="rfq-drawer-backdrop"
            aria-label="Close stage modal"
            disabled={saving}
            onClick={() => setModalPo(null)}
          />
          <div
            className="rfq-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logistics-stage-title"
          >
            <header className="rfq-modal-header">
              <h3 id="logistics-stage-title">
                Update stage · {formatPoId(modalPo)}
              </h3>
              <button
                type="button"
                className="rfq-icon-btn"
                disabled={saving}
                aria-label="Close"
                onClick={() => setModalPo(null)}
              >
                <X className="rfq-icon" />
              </button>
            </header>
            <div className="rfq-modal-body">
              <p className="logistics-modal-lead">
                Buyer <strong>{modalPo.buyer_email}</strong> will receive a
                transactional email when you save.
              </p>
              <label className="logistics-select-label" htmlFor="logistics-stage">
                Logistics pipeline stage
              </label>
              <select
                id="logistics-stage"
                className="logistics-select"
                value={selectedStage}
                disabled={saving}
                onChange={(e) => setSelectedStage(e.target.value)}
              >
                {LOGISTICS_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>
            <footer className="rfq-modal-footer">
              <button
                type="button"
                className="rfq-action-btn"
                disabled={saving}
                onClick={() => setModalPo(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rfq-primary-btn"
                style={{ width: "auto", marginBottom: 0 }}
                disabled={saving || selectedStage === modalPo.current_stage}
                onClick={() => void confirmStageUpdate()}
              >
                {saving ? (
                  <Loader2 className="rfq-icon spin" aria-hidden />
                ) : (
                  <Truck className="rfq-icon" aria-hidden />
                )}
                {saving ? "Updating…" : "Save stage"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <div className="rfq-toast-stack" aria-live="polite">
        {toast ? <div className="rfq-toast">{toast}</div> : null}
      </div>
    </div>
  );
}
