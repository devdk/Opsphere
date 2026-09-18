import { NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listTasks());
}

export async function POST(req: Request) {
  const b = (await req.json()) as {
    name?: string;
    action?: string;
    topic?: string;
    cron?: string;
    timezone?: string;
  };
  if (!b.name || !b.cron) {
    return NextResponse.json({ error: "name and cron are required" }, { status: 400 });
  }
  return NextResponse.json(
    createTask({
      name: b.name,
      action: b.action,
      topic: b.topic ?? null,
      cron: b.cron,
      timezone: b.timezone,
    })
  );
}
