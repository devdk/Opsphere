"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}
interface Action {
  type: string;
  params?: Record<string, unknown>;
}

const ACTION_RE = /<action>([\s\S]*?)<\/action>/i;

function splitAction(content: string): { text: string; action: Action | null } {
  const m = content.match(ACTION_RE);
  if (!m) return { text: content, action: null };
  const text = content.replace(ACTION_RE, "").trim();
  try {
    return { text, action: JSON.parse(m[1].trim()) as Action };
  } catch {
    return { text, action: null };
  }
}

// Run an action; returns a human-readable result string fed back to the model.
async function runAction(action: Action): Promise<string> {
  const p = action.params || {};
  switch (action.type) {
    case "get_stats": {
      const d = await (await fetch("/api/stats")).json();
      return `posts queued ${d.postsQueued}, emails this week ${d.emailsSentThisWeek}, leads ${d.leadsTotal}`;
    }
    case "diagnose": {
      const d = await (await fetch("/api/debug")).json();
      return JSON.stringify(d);
    }
    case "get_errors": {
      const d = await (await fetch("/api/messages?filter=errors")).json();
      if (!Array.isArray(d) || d.length === 0) return "No errors logged.";
      return d
        .slice(0, 10)
        .map((m: { title: string; body: string; created_at: string }) =>
          `- [${m.created_at}] ${m.title}: ${m.body ?? ""}`
        )
        .join("\n");
    }
    case "run_check": {
      const svc = String(p.service || "gemini");
      const d = await (await fetch(`/api/settings/test?service=${svc}`)).json();
      return d.ok ? `${svc}: OK ${d.detail ?? ""}` : `${svc}: FAILED ${d.error ?? ""}`;
    }
    case "draft_post": {
      const r = await fetch("/api/posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: p.platform || "linkedin", topic: p.topic }),
      });
      const d = await r.json();
      return r.ok ? `drafted post #${d.id}` : `draft failed: ${d.error}`;
    }
    case "find_agencies":
    case "draft_all_emails":
    case "send_email":
      return "The Leads/Email module isn't built yet.";
    case "reschedule":
      return "Scheduling is managed on the Tasks page.";
    default:
      return `Unknown action: ${action.type}`;
  }
}

const DEBUG_ACTIONS = new Set(["diagnose", "get_errors", "run_check"]);

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Stream an assistant reply for the given history; returns nothing (updates state).
  async function streamAssistant(history: Msg[]) {
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "chat failed");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: acc };
          return c;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: "Error: " + (e as Error).message };
        return c;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    await streamAssistant(next);
  }

  // Execute an action card; feed the result back so the assistant interprets it.
  async function execute(action: Action): Promise<string> {
    const result = await runAction(action);
    if (DEBUG_ACTIONS.has(action.type)) {
      // build current history from latest state, append tool result, re-query
      setMessages((m) => {
        const history: Msg[] = [
          ...m,
          { role: "user", content: `Tool result — ${action.type}:\n${result}` },
        ];
        // fire the interpretation stream after state commit
        setTimeout(() => streamAssistant(history), 0);
        return history;
      });
    }
    return result;
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Command Chat</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Run commands, draft content, or debug the app ("why are images failing?").
          </p>
        </div>
        <button
          onClick={() => setMessages([])}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          Clear
        </button>
      </header>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-4">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-text-secondary">
            <p>Try:</p>
            <ul className="space-y-1">
              <li>• "Run a full diagnostic"</li>
              <li>• "Why did the last task fail?"</li>
              <li>• "Check if LinkedIn is connected"</li>
              <li>• "Draft a LinkedIn post about Elementor performance"</li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={i}
            msg={m}
            streaming={streaming && i === messages.length - 1}
            onExecute={execute}
          />
        ))}
        <div ref={endRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a command or a debug question…"
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  streaming,
  onExecute,
}: {
  msg: Msg;
  streaming: boolean;
  onExecute: (a: Action) => Promise<string>;
}) {
  const isUser = msg.role === "user";
  const { text, action } = isUser
    ? { text: msg.content, action: null }
    : splitAction(msg.content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
          isUser ? "bg-accent text-bg" : "border border-border bg-bg text-text-primary"
        }`}
      >
        {text ? (
          <pre className="whitespace-pre-wrap font-sans">{text}</pre>
        ) : streaming ? (
          <span className="text-text-secondary">Thinking…</span>
        ) : null}
        {action && <ActionCard action={action} onExecute={onExecute} />}
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onExecute,
}: {
  action: Action;
  onExecute: (a: Action) => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await onExecute(action));
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-accent/40 bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-accent">{action.type}</p>
          {action.params && Object.keys(action.params).length > 0 && (
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {JSON.stringify(action.params)}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-bg disabled:opacity-40"
        >
          {busy ? "Running…" : "Execute"}
        </button>
      </div>
      {result && (
        <p className="mt-2 whitespace-pre-wrap text-[11px] text-text-secondary">{result}</p>
      )}
    </div>
  );
}
