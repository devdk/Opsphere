"use client";

import { useCallback, useEffect, useState } from "react";

interface Message {
  id: number;
  kind: string;
  level: string;
  title: string;
  body: string | null;
  link: string | null;
  recipient: string | null;
  is_read: number;
  created_at: string;
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "errors", label: "Errors" },
  { key: "email", label: "Emails" },
];

const LEVEL_COLOR: Record<string, string> = {
  info: "#888888",
  success: "#c8f542",
  warning: "#fbbf24",
  error: "#f87171",
};

export default function MessagesPage() {
  const [items, setItems] = useState<Message[]>([]);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    const r = await fetch(`/api/messages?filter=${filter}`);
    if (r.ok) setItems(await r.json());
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  async function markRead(m: Message) {
    if (m.is_read) return;
    await fetch(`/api/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    load();
  }
  async function markAll() {
    await fetch("/api/messages/read-all", { method: "POST" });
    load();
  }
  async function remove(m: Message) {
    await fetch(`/api/messages/${m.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Messages</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Notifications and sent emails in one place.
          </p>
        </div>
        <button
          onClick={markAll}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          Mark all read
        </button>
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              filter === f.key
                ? "bg-accent text-bg"
                : "border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-text-secondary">Nothing here yet.</p>
        )}
        {items.map((m) => (
          <div
            key={m.id}
            onClick={() => markRead(m)}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
              m.is_read ? "border-border bg-surface" : "border-accent/40 bg-surface"
            }`}
          >
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: LEVEL_COLOR[m.level] || "#888" }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{m.title}</span>
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-secondary">
                  {m.kind}
                </span>
                {!m.is_read && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </div>
              {m.body && (
                <p className="mt-0.5 text-xs text-text-secondary">{m.body}</p>
              )}
              <p className="mt-1 text-[11px] text-text-secondary">
                {m.created_at} UTC
                {m.recipient ? ` · to ${m.recipient}` : ""}
                {m.link && (
                  <>
                    {" · "}
                    <a href={m.link} className="text-accent hover:underline">
                      open
                    </a>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(m);
              }}
              className="text-text-secondary hover:text-red-400"
              aria-label="Delete"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
