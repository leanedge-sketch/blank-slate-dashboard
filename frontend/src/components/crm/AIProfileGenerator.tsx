import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { getApiBaseUrl } from "../../lib/api-base";
import { getAuthAccessToken } from "../../lib/auth-session";
import { sanitizeAiHtml } from "../../utils/htmlPreview";
import { Loader2 } from "lucide-react";

type AIProfileGeneratorProps = {
  customerId: string;
  active: boolean;
  onComplete: () => void;
  onError?: (message: string) => void;
};

class StreamAbortedError extends Error {
  constructor() {
    super("aborted");
    this.name = "StreamAbortedError";
  }
}

export function AIProfileGenerator({
  customerId,
  active,
  onComplete,
  onError,
}: AIProfileGeneratorProps) {
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "streaming" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active || !customerId) {
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    let finished = false;
    setDraft("");
    setError(null);
    setStatus("connecting");

    void (async () => {
      const token = await getAuthAccessToken();
      const url = `${getApiBaseUrl()}/crm/customers/${customerId}/generate-icp-stream`;
      try {
        await fetchEventSource(url, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
          openWhenHidden: true,
          async onopen(response) {
            if (response.ok) {
              setStatus("streaming");
              return;
            }
            throw new Error(`Stream failed (${response.status})`);
          },
          onmessage(ev) {
            if (ev.event === "chunk") {
              let piece = ev.data || "";
              try {
                const parsed = JSON.parse(ev.data) as { t?: string };
                if (typeof parsed.t === "string") piece = parsed.t;
              } catch {
                /* raw chunk */
              }
              setDraft((prev) => prev + piece);
              return;
            }
            if (ev.event === "done") {
              finished = true;
              setStatus("idle");
              onCompleteRef.current();
              return;
            }
            if (ev.event === "error") {
              let message = "ICP generation failed";
              try {
                const parsed = JSON.parse(ev.data) as { message?: string };
                if (parsed.message) message = parsed.message;
              } catch {
                if (ev.data) message = ev.data;
              }
              throw new Error(message);
            }
          },
          onerror(err) {
            if (controller.signal.aborted) {
              throw new StreamAbortedError();
            }
            const message =
              err instanceof Error ? err.message : "Connection to the AI stream dropped.";
            setStatus("error");
            setError(message);
            onErrorRef.current?.(message);
            throw err instanceof Error ? err : new Error(message);
          },
        });
        if (!finished && !controller.signal.aborted) {
          onCompleteRef.current();
        }
      } catch (err) {
        if (err instanceof StreamAbortedError || controller.signal.aborted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : "ICP stream failed";
        setStatus("error");
        setError(message);
        onErrorRef.current?.(message);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [active, customerId]);

  if (!active && !draft) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        {(status === "connecting" || status === "streaming") && (
          <Loader2 size={16} className="animate-spin text-teal-600" />
        )}
        {status === "connecting" && "Connecting to AI…"}
        {status === "streaming" && "Writing Ideal Customer Profile…"}
        {status === "error" && "Stream interrupted"}
        {status === "idle" && draft && "Draft complete"}
      </div>
      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : null}
      <div
        className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800"
        dangerouslySetInnerHTML={{ __html: sanitizeAiHtml(draft || "Waiting for the first tokens…") }}
      />
    </section>
  );
}
