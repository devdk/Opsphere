import { NextResponse } from "next/server";
import { initSchema } from "@/lib/db";
import { startScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

// POST /api/init -> create schema (if needed) and start the cron scheduler.
export async function POST() {
  try {
    initSchema();
    startScheduler();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
