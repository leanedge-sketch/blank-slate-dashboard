import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Loader2,
  Package,
  RefreshCw,
  Send,
  ShieldOff,
  X,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  getLoopASupabase,
  isLoopASupabaseConfigured,
} from "../../lib/loopASupabase";
import { getApiOrigin } from "../../lib/api-base";
import {
  formatRfqStatusLabel,
  normalizeRfqStatus,
  type RfqCartItem,
  type RfqRow,
} from "../../types/rfq";

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: "under_review", label: "Mark Under Review" },
  { status: "sourcing", label: "Proceed to Sourcing" },
  { status: "quoted", label: "Mark Quoted" },
  { status: "closed", label: "Close RFQ" },
];

function playSoftChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    // Autoplay / AudioContext may be blocked — toast still shows.
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function parseItems(raw: RfqRow["items"]): RfqCartItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [];
}

function statusBadgeClass(status: string): string {
  const s = normalizeRfqStatus(status);
  switch (s) {
    case "pending":
      return "rfq-badge rfq-badge--pending";
    case "under_review":
      return "rfq-badge rfq-badge--review";
    case "sourcing":
      return "rfq-badge rfq-badge--sourcing";
    case "quoted":
      return "rfq-badge rfq-badge--quoted";
    case "closed":
      return "rfq-badge rfq-badge--closed";
    default:
      return "rfq-badge";
  }
}

type Toast = { id: number; message: string };

export function RfqsPage() {
  const [rows, setRows] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [sourcingOpen, setSourcingOpen] = useState(false);
  const [sourcingBusy, setSourcingBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const configured = isLoopASupabaseConfigured();

  const pushToast = useCallback((message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const loadRfqs = useCallback(async () => {
    if (!configured) {
      setError(
        "Loop A Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to the shared public-site project.",
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getLoopASupabase();
      const { data, error: qErr } = await supabase
        .from("rfqs")
        .select("*")
        .order("created_at", { ascending: false });
      if (qErr) throw qErr;
      setRows((data as RfqRow[]) ?? []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to load RFQs from Supabase.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void loadRfqs();
  }, [loadRfqs]);

  useEffect(() => {
    if (!configured) return;

    let channel: RealtimeChannel | null = null;
    try {
      const supabase = getLoopASupabase();
      channel = supabase
        .channel("public:rfqs")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "rfqs" },
          (payload) => {
            const row = payload.new as RfqRow;
            setRows((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            });
            pushToast(`New RFQ received from ${row.company_name}`);
            playSoftChime();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rfqs" },
          (payload) => {
            const row = payload.new as RfqRow;
            setRows((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)),
            );
          },
        )
        .subscribe();
    } catch (err) {
      console.error("[rfqs] realtime subscribe failed", err);
    }

    return () => {
      if (channel) {
        void getLoopASupabase().removeChannel(channel);
      }
    };
  }, [configured, pushToast]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    setError(null);
    try {
      const supabase = getLoopASupabase();
      const { data, error: uErr } = await supabase
        .from("rfqs")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();
      if (uErr) throw uErr;
      const row = data as RfqRow;
      setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      pushToast(`Status updated to ${formatRfqStatusLabel(status)}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to update RFQ status.";
      setError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const confirmSourcingRequest = async () => {
    if (!selected) return;
    setSourcingBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getApiOrigin()}/api/sourcing/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfqId: selected.id }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        status?: string;
        detail?: string | unknown;
        error?: string;
        supplierCount?: number;
      };

      if (!res.ok || data.success === false) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.error || "Failed to request supplier pricing.";
        throw new Error(detail);
      }

      const nextStatus = data.status || "under_review";
      setRows((prev) =>
        prev.map((r) =>
          r.id === selected.id ? { ...r, status: nextStatus } : r,
        ),
      );
      setSourcingOpen(false);
      pushToast("Pricing requested from suppliers");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to request supplier pricing.";
      setError(msg);
    } finally {
      setSourcingBusy(false);
    }
  };

  return (
    <div className="rfq-page">
      <div className="page-header rfq-page-header">
        <div>
          <p className="rfq-kicker">Loop A · Public site inbox</p>
          <h2>Inbound RFQs</h2>
          <p className="section-description">
            Live feed from the shared Supabase <code>rfqs</code> table. New
            submissions appear instantly — no refresh needed.
          </p>
        </div>
        <button
          type="button"
          className="rfq-refresh-btn"
          onClick={() => void loadRfqs()}
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
            Loading RFQs…
          </div>
        ) : rows.length === 0 ? (
          <div className="rfq-empty">
            <Inbox className="rfq-icon-lg" aria-hidden />
            <p>No RFQs yet. Submit one from the public catalog cart to see it here.</p>
          </div>
        ) : (
          <table className="data-table rfq-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>RFQ Ref</th>
                <th>Buyer Company</th>
                <th>Contact Name</th>
                <th>Volume</th>
                <th>Incoterms</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    selectedId === row.id ? "rfq-row is-selected" : "rfq-row"
                  }
                  onClick={() => setSelectedId(row.id)}
                >
                  <td>{formatDate(row.created_at)}</td>
                  <td className="rfq-ref">{row.reference || row.id.slice(0, 8)}</td>
                  <td>{row.company_name}</td>
                  <td>{row.contact_name}</td>
                  <td>
                    {row.volume} {row.unit}
                  </td>
                  <td>{row.incoterms}</td>
                  <td>
                    <span className={statusBadgeClass(row.status)}>
                      {formatRfqStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="rfq-link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(row.id);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="rfq-drawer-root" role="presentation">
          <button
            type="button"
            className="rfq-drawer-backdrop"
            aria-label="Close RFQ detail"
            onClick={() => {
              setSelectedId(null);
              setSourcingOpen(false);
            }}
          />
          <aside
            className="rfq-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rfq-drawer-title"
          >
            <header className="rfq-drawer-header">
              <div>
                <p className="rfq-kicker">RFQ detail</p>
                <h3 id="rfq-drawer-title">
                  {selected.reference || selected.id.slice(0, 8)}
                </h3>
              </div>
              <button
                type="button"
                className="rfq-icon-btn"
                aria-label="Close"
                onClick={() => {
                  setSelectedId(null);
                  setSourcingOpen(false);
                }}
              >
                <X className="rfq-icon" />
              </button>
            </header>

            <div className="rfq-drawer-body">
              <button
                type="button"
                className="rfq-primary-btn"
                onClick={() => setSourcingOpen(true)}
              >
                <Send className="rfq-icon" aria-hidden />
                Request Supplier Pricing
              </button>

              <div className="rfq-meta-grid">
                <div>
                  <span className="rfq-meta-label">Company</span>
                  <p>{selected.company_name}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Contact</span>
                  <p>{selected.contact_name}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Email</span>
                  <p>
                    <a href={`mailto:${selected.email}`}>{selected.email}</a>
                  </p>
                </div>
                <div>
                  <span className="rfq-meta-label">Phone</span>
                  <p>{selected.phone || "—"}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Volume</span>
                  <p>
                    {selected.volume} {selected.unit}
                  </p>
                </div>
                <div>
                  <span className="rfq-meta-label">Packaging</span>
                  <p>{selected.packaging}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Incoterms</span>
                  <p>{selected.incoterms}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Target delivery</span>
                  <p>{selected.target_delivery_date || "—"}</p>
                </div>
                <div>
                  <span className="rfq-meta-label">Status</span>
                  <p>
                    <span className={statusBadgeClass(selected.status)}>
                      {formatRfqStatusLabel(selected.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="rfq-meta-label">Received</span>
                  <p>{formatDate(selected.created_at)}</p>
                </div>
              </div>

              <h4 className="rfq-section-title">
                <Package className="rfq-icon" aria-hidden />
                Requested chemicals
              </h4>
              <ul className="rfq-items-list">
                {parseItems(selected.items).length === 0 ? (
                  <li className="rfq-item-empty">No line items stored.</li>
                ) : (
                  parseItems(selected.items).map((item, idx) => (
                    <li key={`${item.casNumber}-${idx}`} className="rfq-item">
                      <div>
                        <p className="rfq-item-name">{item.name}</p>
                        <p className="rfq-item-cas">CAS {item.casNumber}</p>
                      </div>
                      <div className="rfq-item-meta">
                        {item.quantity ? <span>Qty {item.quantity}</span> : null}
                        {item.packaging ? <span>{item.packaging}</span> : null}
                      </div>
                      {item.notes ? (
                        <p className="rfq-item-notes">{item.notes}</p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>

              <h4 className="rfq-section-title">Status actions</h4>
              <div className="rfq-actions">
                {STATUS_ACTIONS.map((action) => {
                  const active =
                    normalizeRfqStatus(selected.status) === action.status;
                  return (
                    <button
                      key={action.status}
                      type="button"
                      className={
                        active
                          ? "rfq-action-btn is-active"
                          : "rfq-action-btn"
                      }
                      disabled={updating || active}
                      onClick={() =>
                        void updateStatus(selected.id, action.status)
                      }
                    >
                      {updating ? (
                        <Loader2 className="rfq-icon spin" aria-hidden />
                      ) : active ? (
                        <CheckCircle2 className="rfq-icon" aria-hidden />
                      ) : null}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {sourcingOpen && selected ? (
        <div className="rfq-modal-root" role="presentation">
          <button
            type="button"
            className="rfq-drawer-backdrop"
            aria-label="Close sourcing confirmation"
            disabled={sourcingBusy}
            onClick={() => setSourcingOpen(false)}
          />
          <div
            className="rfq-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rfq-sourcing-title"
          >
            <header className="rfq-modal-header">
              <h3 id="rfq-sourcing-title">Confirm supplier pricing request</h3>
              <button
                type="button"
                className="rfq-icon-btn"
                disabled={sourcingBusy}
                aria-label="Close"
                onClick={() => setSourcingOpen(false)}
              >
                <X className="rfq-icon" />
              </button>
            </header>
            <div className="rfq-modal-body">
              <div className="rfq-privacy-banner">
                <ShieldOff className="rfq-icon" aria-hidden />
                <p>
                  <strong>Buyer details are HIDDEN.</strong> Suppliers will not
                  receive company name, contact name, email, or phone.
                </p>
              </div>
              <dl className="rfq-confirm-dl">
                <div>
                  <dt>Volume</dt>
                  <dd>
                    {selected.volume} {selected.unit}
                  </dd>
                </div>
                <div>
                  <dt>Packaging</dt>
                  <dd>{selected.packaging}</dd>
                </div>
                <div>
                  <dt>Incoterms</dt>
                  <dd>{selected.incoterms}</dd>
                </div>
                <div>
                  <dt>Target delivery</dt>
                  <dd>{selected.target_delivery_date || "—"}</dd>
                </div>
              </dl>
              <h4 className="rfq-section-title">Items to send</h4>
              <ul className="rfq-items-list">
                {parseItems(selected.items).map((item, idx) => (
                  <li key={`${item.casNumber}-${idx}`} className="rfq-item">
                    <p className="rfq-item-name">{item.name}</p>
                    <p className="rfq-item-cas">CAS {item.casNumber}</p>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="rfq-modal-footer">
              <button
                type="button"
                className="rfq-action-btn"
                disabled={sourcingBusy}
                onClick={() => setSourcingOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rfq-primary-btn"
                disabled={sourcingBusy}
                onClick={() => void confirmSourcingRequest()}
              >
                {sourcingBusy ? (
                  <Loader2 className="rfq-icon spin" aria-hidden />
                ) : (
                  <Send className="rfq-icon" aria-hidden />
                )}
                {sourcingBusy ? "Sending…" : "Send to suppliers"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <div className="rfq-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="rfq-toast">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
