import { NextResponse } from "next/server";
import { verifyLinkedIn } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

// GET /api/linkedin/verify -> calls LinkedIn userinfo to confirm the token works.
export async function GET() {
  try {
    const me = await verifyLinkedIn();
    const urnMatches =
      !process.env.LINKEDIN_PERSON_URN ||
      process.env.LINKEDIN_PERSON_URN === me.urn;
    return NextResponse.json({ ok: true, ...me, urnMatches });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
