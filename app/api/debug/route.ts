import { NextResponse } from "next/server";
import { db, ensureOps, getStats, listMessages, listTasks } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/debug -> live system snapshot for the in-house debugger.
export async function GET() {
  try {
    ensureOps();
    const n = (sql: string) =>
      (db.prepare(sql).get() as { n: number }).n;

    const counts = {
      posts: n("SELECT COUNT(*) AS n FROM posts"),
      leads: n("SELECT COUNT(*) AS n FROM leads"),
      messages: n("SELECT COUNT(*) AS n FROM messages"),
      tasks: n("SELECT COUNT(*) AS n FROM tasks"),
    };

    const env = {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      gmail: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      linkedin: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
      linkedin_urn: Boolean(process.env.LINKEDIN_PERSON_URN),
      meta: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_USER_ID),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      image_api_url: process.env.IMAGE_API_URL || "(default Pollinations)",
    };

    const recentErrors = listMessages("errors")
      .slice(0, 8)
      .map((m) => ({ title: m.title, body: m.body, at: m.created_at }));

    const recentRuns = db
      .prepare(
        "SELECT task_id, status, detail, created_at FROM task_runs ORDER BY id DESC LIMIT 8"
      )
      .all();

    const tasks = listTasks().map((t) => ({
      id: t.id,
      name: t.name,
      enabled: t.enabled,
      cron: t.cron,
      last_status: t.last_status,
      last_run_at: t.last_run_at,
      last_detail: t.last_detail,
    }));

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      node: process.version,
      stats: getStats(),
      counts,
      env,
      tasks,
      recentErrors,
      recentRuns,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
