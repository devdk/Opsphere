import { NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";
import { verifyMailer } from "@/lib/mailer";
import { verifyLinkedIn } from "@/lib/linkedin";
import { verifyMeta } from "@/lib/meta";
import { getSetting, setSetting } from "@/lib/db";
import { uploadPublicImage } from "@/lib/imagehost";

export const dynamic = "force-dynamic";

// Transparent 1x1 PNG used to live-test the Cloudinary preset.
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

// GET /api/settings/test?service=gemini|gmail|linkedin|meta|cloudinary
export async function GET(req: Request) {
  const service = new URL(req.url).searchParams.get("service");
  try {
    if (service === "gemini") {
      const t = await generateText("Reply with the single word: ok");
      return NextResponse.json({ ok: true, detail: t.slice(0, 40) || "ok" });
    }
    if (service === "gmail") {
      await verifyMailer();
      return NextResponse.json({ ok: true, detail: "SMTP login OK" });
    }
    if (service === "linkedin") {
      const me = await verifyLinkedIn();
      return NextResponse.json({ ok: true, detail: me.name || me.urn || "OK" });
    }
    if (service === "meta") {
      const ig = await verifyMeta();
      // First successful verify = token known-active; start the 60-day clock
      // for expiry warnings (exact date comes from debug_token when app
      // credentials are configured).
      if (!getSetting("meta_token_issued_at")) {
        setSetting("meta_token_issued_at", new Date().toISOString());
      }
      return NextResponse.json({
        ok: true,
        detail: ig.username ? `@${ig.username}` : ig.id,
      });
    }
    if (service === "cloudinary") {
      const url = await uploadPublicImage(PIXEL_PNG, "connectivity-test.png");
      return NextResponse.json({ ok: true, detail: `upload OK (${new URL(url).hostname})` });
    }
    return NextResponse.json({ ok: false, error: "unknown service" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
