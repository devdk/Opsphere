import { NextResponse } from "next/server";
import { db, initSchema, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

// The settings table also holds tokens and expiry dates written by lib/meta and
// lib/tokens. Only these user preferences may be read or written over HTTP.
const PREFERENCE_KEYS = new Set([
  "tone",
  "brand_accent",
  "brand_bg",
  "owner_name",
  "agency",
  "ig_audience",
]);

function mask(s: string): string {
  if (s.includes("@")) {
    const [u, d] = s.split("@");
    return `${u.slice(0, 2)}***@${d}`;
  }
  return s.length > 6 ? `${s.slice(0, 3)}…${s.slice(-2)}` : "***";
}

// GET /api/settings -> stored settings + integration status
export async function GET() {
  initSchema();
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    if (PREFERENCE_KEYS.has(r.key)) settings[r.key] = r.value;
  }

  return NextResponse.json({
    settings,
    env: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      gmail: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      meta: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_USER_ID),
      linkedin: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      cloudinary: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET
      ),
    },
    gmailUser: process.env.GMAIL_USER ? mask(process.env.GMAIL_USER) : null,
    previewEmail:
      process.env.PREVIEW_EMAIL || process.env.GMAIL_USER || null,
  });
}

// POST /api/settings  body: { key, value }
export async function POST(req: Request) {
  const { key, value } = (await req.json()) as { key?: string; value?: unknown };
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  if (!PREFERENCE_KEYS.has(key)) {
    return NextResponse.json({ error: `unknown setting: ${key}` }, { status: 400 });
  }
  setSetting(key, String(value ?? ""));
  return NextResponse.json({ ok: true });
}
