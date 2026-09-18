"use client";

import { useCallback, useEffect, useState } from "react";

interface Task {
  id: number;
  name: string;
  action: string;
  topic: string | null;
  cron: string;
  timezone: string;
  enabled: number;
  builtin: number;
  last_run_at: string | null;
  last_status: string | null;
  last_detail: string | null;
}

const ACTIONS = [
  { value: "generate_linkedin", label: "Generate LinkedIn post" },
  { value: "generate_instagram", label: "Generate Instagram carousel" },
];

const STATUS_COLOR: Record<string, string> = {
  success: "#c8f542",
  error: "#f87171",
  running: "#fbbf24",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [action, setAction] = useState("generate_linkedin");
  const [topic, setTopic] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/tasks");
    if (r.ok) setTasks(await r.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: Task) {
    setBusy(t.id);
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: t.enabled ? 0 : 1 }),
    });
    await load();
    setBusy(null);
  }

  async function runNow(t: Task) {
    setBusy(t.id);
    setMsg(null);
    try {
      const r = await fetch(`/api/tasks/${t.id}/run`, { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? `Ran "${t.name}" — created post #${d.id}` : `${t.name}: ${d.error}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      await load();
      setBusy(null);
    }
  }

  async function remove(t: Task) {
    if (!confirm(`Delete task "${t.name}"?`)) return;
    setBusy(t.id);
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  async function create() {
    if (!name.trim() || !cron.trim()) return;
    setCreating(true);
    setMsg(null);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, action, topic, cron }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "create failed");
      setName("");
      setTopic("");
      setCron("0 9 * * *");
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Scheduled jobs. The scheduler process (<code>npm run scheduler</code>)
          fires enabled tasks; you can also run any task now.
        </p>
      </header>

      <section className="space-y-3">
        {tasks.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  {t.builtin === 1 && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary">
                      built-in
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  <code>{t.cron}</code> · {t.timezone} ·{" "}
                  {ACTIONS.find((a) => a.value === t.action)?.label || t.action}
                  {t.topic ? ` · topic: ${t.topic}` : " · topic: rotating"}
                </p>
                <p className="mt-1 text-xs">
                  {t.last_status ? (
                    <span style={{ color: STATUS_COLOR[t.last_status] || "#888" }}>
                      ● {t.last_status}
                    </span>
                  ) : (
                    <span className="text-text-secondary">● never run</span>
                  )}
                  {t.last_run_at && (
                    <span className="text-text-secondary"> · {t.last_run_at} UTC</span>
                  )}
                  {t.last_detail && (
                    <span className="text-text-secondary"> · {t.last_detail}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggle(t)}
                  disabled={busy === t.id}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    t.enabled
                      ? "bg-accent text-bg"
                      : "border border-border text-text-secondary"
                  }`}
                >
                  {t.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={() => runNow(t)}
                  disabled={busy === t.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  {busy === t.id ? "Running…" : "Run now"}
                </button>
                {t.builtin === 0 && (
                  <button
                    onClick={() => remove(t)}
                    disabled={busy === t.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {msg && <p className="text-xs text-accent">{msg}</p>}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold">New task</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Task name"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic (optional — blank = rotate)"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            placeholder="Cron (e.g. 0 9 * * 1-5)"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm font-mono outline-none focus:border-accent"
          />
        </div>
        <p className="text-xs text-text-secondary">
          Cron format: <code>min hour day month weekday</code> (Asia/Kolkata).
          Examples: <code>0 9 * * *</code> daily 9am · <code>0 8 * * 1,4</code>{" "}
          Mon &amp; Thu 8am · <code>30 18 * * 5</code> Fri 6:30pm.
        </p>
        <button
          onClick={create}
          disabled={creating || !name.trim() || !cron.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
        >
          {creating ? "Creating…" : "Create task"}
        </button>
      </section>
    </div>
  );
}
