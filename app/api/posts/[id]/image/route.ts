import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPostById, updatePost } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/posts/:id/image  (multipart, field "image") -> set a custom image.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const post = getPostById(id);
    if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "image file required" }, { status: 400 });
    }
    const type = file.type || "image/png";
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "file must be an image" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dir = path.join(process.cwd(), "public", "generated");
    fs.mkdirSync(dir, { recursive: true });
    const ext = type.includes("png")
      ? "png"
      : type.includes("webp")
        ? "webp"
        : type.includes("gif")
          ? "gif"
          : "jpg";
    const fname = `li-${id}-upload-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, fname), buf);

    const meta = post.content_json ? JSON.parse(post.content_json) : {};
    const merged = JSON.stringify({
      ...meta,
      imagePath: `/generated/${fname}`,
      imageProvider: "upload",
      imageError: undefined,
    });
    return NextResponse.json(updatePost(id, { content_json: merged }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
