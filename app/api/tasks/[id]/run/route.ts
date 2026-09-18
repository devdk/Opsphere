import { NextResponse } from "next/server";
import { getTask } from "@/lib/db";
import { runTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const task = getTask(Number(params.id));
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const origin = process.env.APP_URL || new URL(req.url).origin;
    const out = await runTask(task, origin);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
