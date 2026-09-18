import { NextResponse } from "next/server";
import { getStats } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/stats -> live counts for the topbar stats strip.
export async function GET() {
  try {
    const stats = getStats();
    // Integration status is a placeholder until tokens are wired up.
    const instagramConnected = Boolean(process.env.META_ACCESS_TOKEN);
    const linkedinConnected = Boolean(process.env.LINKEDIN_ACCESS_TOKEN);

    return NextResponse.json({
      ...stats,
      instagramConnected,
      linkedinConnected,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
