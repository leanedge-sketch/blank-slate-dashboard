import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { getApiBaseUrl } from "../lib/api-base";

export type LoginFailContext =
  | "invalid_credentials"
  | "employee_missing"
  | "expired_link"
  | "network";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LoginAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  failContext: LoginFailContext;
  email?: string;
}

export function LoginAssistantDrawer({
  open,
  onClose,
  failContext,
  email,
}: LoginAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMessages([]);
      setDraft("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  if (!open) return null;

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    try {
      const resp = await fetch(`${getApiBaseUrl()}/ai/diagnose-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          fail_context: failContext,
          email: email || null,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        content?: string;
        is_fallback?: boolean;
        detail?: string;
      };
      if (!resp.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Support assistant is unavailable. Please try again or email IT.",
        );
      }
      if (data.is_fallback) {
        console.warn("[login-assistant] AI response used OpenAI fallback");
      }
      const reply = (data.content || "").trim();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            reply ||
            "Please confirm you are using your LeanChem corporate email, or contact IT admin Mohammed Sani if your employee profile is missing.",
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Support assistant is unavailable. Contact IT admin Mohammed Sani.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close help"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-700 bg-slate-950 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="h-5 w-5 text-cyan-400" />
            <div>
              <p className="text-sm font-semibold">Need Help?</p>
              <p className="text-xs text-slate-400">IT login support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="text-xs text-slate-500">
            Describe what happened (for example, you started yesterday and cannot
            log in). This assistant does not check passwords.
          </p>
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={`rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 bg-blue-600/30 text-blue-50"
                  : "mr-8 bg-slate-800 text-slate-100"
              }`}
            >
              {msg.content}
            </div>
          ))}
          {sending && (
            <p className="text-xs text-slate-500">Assistant is typing…</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <form
          className="border-t border-slate-800 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Describe the login issue…"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              maxLength={2000}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-xl bg-cyan-600 p-2 text-white hover:bg-cyan-500 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
