import { NextResponse } from "next/server";
import { db, initSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health -> reports whether the DB, mailer and Gemini key are wired up.
// Pass ?deep=1 to also attempt a live SMTP login (slower).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";

  // --- Database ---------------------------------------------------------
  const database: {
    ok: boolean;
    tables: string[];
    error?: string;
  } = { ok: false, tables: [] };
  try {
    initSchema();
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string }[];
    database.tables = rows.map((r) => r.name);
    database.ok =
      ["leads", "posts", "settings"].every((t) =>
        database.tables.includes(t)
      );
  } catch (err) {
    database.error = (err as Error).message;
  }

  // --- Gemini -----------------------------------------------------------
  const gemini = { configured: Boolean(process.env.GEMINI_API_KEY) };

  // --- Mailer -----------------------------------------------------------
  const mailer: {
    configured: boolean;
    previewConfigured: boolean;
    verified?: boolean;
    error?: string;
  } = {
    configured: Boolean(
      process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
    ),
    previewConfigured: Boolean(
      process.env.PREVIEW_EMAIL || process.env.GMAIL_USER
    ),
  };
  if (deep && mailer.configured) {
    try {
      const { verifyMailer } = await import("@/lib/mailer");
      mailer.verified = await verifyMailer();
    } catch (err) {
      mailer.verified = false;
      mailer.error = (err as Error).message;
    }
  }

  // --- Integrations (presence only) ------------------------------------
  const integrations = {
    instagram: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_USER_ID),
    linkedin: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
    hunter: Boolean(process.env.HUNTER_API_KEY),
  };

  const ok = database.ok && gemini.configured && mailer.configured;

  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      database,
      gemini,
      mailer,
      integrations,
    },
    { status: ok ? 200 : 503 }
  );
}
