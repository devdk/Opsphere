import { NextResponse } from "next/server";
import { getPostById, updatePost, deletePost } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/posts/:id  body: { caption?, hashtags?, status?, topic?, audience? }
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!getPostById(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = await req.json();
  return NextResponse.json(updatePost(id, body));
}

// DELETE /api/posts/:id
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  deletePost(Number(params.id));
  return NextResponse.json({ ok: true });
}
