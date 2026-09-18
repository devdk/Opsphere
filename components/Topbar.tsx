"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  postsQueued: number;
  emailsSentThisWeek: number;
  leadsTotal: number;
  instagramConnected: boolean;
  linkedinConnected: boolean;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold leading-none">{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

function StatusDot({ label, connected }: { label: string; connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: connected ? "#c8f542" : "#888888" }}
        title={connected ? "Connected" : "Not connected"}
      />
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

export default function Topbar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => !cancelled && !d.error && setStats(d))
      .catch(() => {});
    const loadUnread = () =>
      fetch("/api/messages?count=1")
        .then((r) => r.json())
        .then((d) => !cancelled && setUnread(d.unread || 0))
        .catch(() => {});
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4">
      <div className="flex items-center gap-8">
        <Stat label="Posts queued" value={stats?.postsQueued ?? 0} />
        <Stat label="Emails sent this week" value={stats?.emailsSentThisWeek ?? 0} />
        <Stat label="Leads in database" value={stats?.leadsTotal ?? 0} />
      </div>
      <div className="flex items-center gap-6">
        <StatusDot label="Instagram" connected={stats?.instagramConnected ?? false} />
        <StatusDot label="LinkedIn" connected={stats?.linkedinConnected ?? false} />
        <Link
          href="/messages"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary hover:border-accent hover:text-accent"
          title="Messages & notifications"
          aria-label="Messages"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-bg">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
