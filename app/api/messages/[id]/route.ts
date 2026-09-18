import { NextResponse } from "next/server";
import { markMessageRead, deleteMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { read } = (await req.json().catch(() => ({}))) as { read?: boolean };
  markMessageRead(Number(params.id), read !== false);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  deleteMessage(Number(params.id));
  return NextResponse.json({ ok: true });
}
