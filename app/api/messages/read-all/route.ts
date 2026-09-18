import { NextResponse } from "next/server";
import { markAllRead } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  markAllRead();
  return NextResponse.json({ ok: true });
}
