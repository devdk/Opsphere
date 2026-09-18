"use client";

import { useCallback, useEffect, useState } from "react";

interface SettingsData {
  settings: Record<string, string>;
  env: {
    gemini: boolean;
    gmail: boolean;
    meta: boolean;
    linkedin: boolean;
    hunter: boolean;
    cloudinary: boolean;
  };
  gmailUser: string | null;
  previewEmail: string | null;
}

const TONES = ["casual", "semi-formal", "formal"];

// Next occurrence of a given IST hour/min, optionally restricted to weekdays (1=Mon..7=Sun ISO)
function nextRunIST(hour: number, minute: number, weekdays?: number[]): string {
  const now = new Date();
  // Current time in IST
  const istNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  for (let i = 0; i < 14; i++) {
    const d = new Date(istNow);
    d.setDate(istNow.getDate() + i);
    d.setHours(hour, minute, 0, 0);
    const iso = ((d.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun
    if (weekdays && !weekdays.includes(iso)) continue;
    if (d.getTime() <= istNow.getTime()) continue;
    return d.toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "—";
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/settings");
    if (r.ok) setData(await r.json());
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(key: string, value: string) {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setData((d) =>
      d ? { ...d, settings: { ...d.settings, [key]: value } } : d
    );
  }

  async function test(service: string) {
    setTesting(service);
    setMsg(null);
    try {
      const r = await fetch(`/api/settings/test?service=${service}`);
      const d = await r.json();
      setMsg(
        d.ok
          ? `${service}: OK ${d.detail ? "— " + d.detail : ""}`
          : `${service}: ${d.error}`
      );
    } catch (e) {
      setMsg(`${service}: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  }

  async function testEmail() {
    setTesting("email");
    setMsg(null);
    try {
      const r = await fetch("/api/settings/test-email", { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? "Test email sent ✓" : `Email: ${d.error}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTesting(null);
    }
  }

  if (!data) {
    return <p className="text-sm text-text-secondary">Loading settings…</p>;
  }

  const accent = data.settings.brand_accent || "#c8f542";
  const tone = data.settings.tone || "semi-formal";
  const igAudience = data.settings.ig_audience || "";

  const integrations: {
    key: keyof SettingsData["env"];
    label: string;
    testable?: string;
  }[] = [
    { key: "gemini", label: "Gemini API", testable: "gemini" },
    { key: "gmail", label: "Gmail SMTP", testable: "gmail" },
    { key: "linkedin", label: "LinkedIn API", testable: "linkedin" },
    { key: "meta", label: "Meta / Instagram", testable: "meta" },
    { key: "cloudinary", label: "Cloudinary (IG image hosting)", testable: "cloudinary" },
    { key: "hunter", label: "Hunter.io" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Integrations, brand, and scheduler.
        </p>
      </header>

      {/* Integrations */}
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <div className="mt-4 space-y-3">
          {integrations.map((it) => (
            <div key={it.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: data.env[it.key] ? "#c8f542" : "#888" }}
                />
                <span className="text-sm">{it.label}</span>
                <span className="text-xs text-text-secondary">
                  {data.env[it.key] ? "configured" : "not set"}
                </span>
              </div>
              {it.testable && data.env[it.key] && (
                <button
                  onClick={() => test(it.testable as string)}
                  disabled={testing !== null}
                  className="rounded-lg border border-border px-3 py-1 text-xs hover:bg-bg disabled:opacity-40"
                >
                  {testing === it.testable ? "Testing…" : "Test"}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-text-secondary">
          Gmail: {data.gmailUser || "—"} · Preview email:{" "}
          {data.previewEmail || "—"}
        </p>
        {msg && <p className="mt-3 text-xs text-accent">{msg}</p>}
      </section>

      {/* Brand + preferences */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-lg font-semibold">Brand &amp; preferences</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm w-40">Accent color</label>
          <input
            type="color"
            value={accent}
            onChange={(e) => save("brand_accent", e.target.value)}
            className="h-8 w-12 rounded border border-border bg-bg"
          />
          <span className="text-xs text-text-secondary">{accent}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm w-40">Outreach tone</label>
          <select
            value={tone}
            onChange={(e) => save("tone", e.target.value)}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm w-40">Instagram audience</label>
          <input
            defaultValue={igAudience}
            onBlur={(e) => save("ig_audience", e.target.value)}
            placeholder="e.g. UK small-business owners"
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </section>

      {/* Scheduler */}
      <section className="rounded-xl border border-border bg-surface p-6 space-y-3">
        <h2 className="text-lg font-semibold">Scheduler</h2>
        <div className="text-sm">
          <div className="flex justify-between border-b border-border py-2">
            <span>📱 Instagram — daily 7:00 AM IST</span>
            <span className="text-text-secondary">
              next: {nextRunIST(7, 0)}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span>💼 LinkedIn — Mon &amp; Thu 8:00 AM IST</span>
            <span className="text-text-secondary">
              next: {nextRunIST(8, 0, [1, 4])}
            </span>
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          Jobs run in the separate scheduler process (<code>npm run scheduler</code>).
        </p>
        <button
          onClick={testEmail}
          disabled={testing !== null}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-bg disabled:opacity-40"
        >
          {testing === "email" ? "Sending…" : "Test morning email"}
        </button>
      </section>
    </div>
  );
}
