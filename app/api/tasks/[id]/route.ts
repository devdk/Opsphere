import { NextResponse } from "next/server";
import { getTask, updateTask, deleteTask } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!getTask(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  return NextResponse.json(updateTask(id, body));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  deleteTask(Number(params.id));
  return NextResponse.json({ ok: true });
}
