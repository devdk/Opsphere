import { NextResponse } from "next/server";
import { sendPreview } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// POST /api/settings/test-email -> sends a sample preview email immediately.
export async function POST() {
  try {
    const to = process.env.PREVIEW_EMAIL || process.env.GMAIL_USER || "";
    const id = await sendPreview({
      to,
      subject: "Opsphere — test email",
      html:
        "<p>✅ Your command centre can send email.</p>" +
        "<p>This is what your morning preview emails will arrive from.</p>",
      text: "Your command centre can send email.",
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
