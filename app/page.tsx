import { getStats } from "@/lib/db";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const stats = getStats();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Welcome back, DK — here is your command centre at a glance.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Posts queued"
          value={stats.postsQueued}
          hint="Drafts + approved, awaiting publish"
        />
        <StatCard
          label="Emails sent this week"
          value={stats.emailsSentThisWeek}
          hint="Outreach sent in the last 7 days"
        />
        <StatCard
          label="Leads in database"
          value={stats.leadsTotal}
          hint="All captured leads"
        />
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold">Quick start</h2>
        <ul className="mt-3 space-y-2 text-sm text-text-secondary">
          <li>• Generate Instagram carousels and LinkedIn posts.</li>
          <li>• Scrape and store leads, then draft personalised outreach.</li>
          <li>• Review and send emails, all from one place.</li>
          <li>
            • Use{" "}
            <span className="text-accent">Command Chat</span> to drive the whole
            workflow with natural language.
          </li>
        </ul>
      </section>
    </div>
  );
}
