import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPostById, updatePost } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/posts/:id/slides  (multipart, repeated field "slides")
 * Saves the client-rendered slide PNGs so the publish route can upload them.
 * Stores paths in content_json.slidePaths.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const post = getPostById(id);
    if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (post.platform !== "instagram") {
      return NextResponse.json(
        { error: "slides are only used for Instagram posts" },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const files = form
      .getAll("slides")
      .filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "slide images required (field: slides)" },
        { status: 400 }
      );
    }

    const dir = path.join(process.cwd(), "public", "generated");
    fs.mkdirSync(dir, { recursive: true });

    const slidePaths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = Buffer.from(await files[i].arrayBuffer());
      const fname = `ig-${id}-slide-${i + 1}.png`;
      fs.writeFileSync(path.join(dir, fname), buf);
      slidePaths.push(`/generated/${fname}`);
    }

    const meta = post.content_json ? JSON.parse(post.content_json) : {};
    const merged = JSON.stringify({
      ...meta,
      slidePaths,
      slidesRenderedAt: new Date().toISOString(),
    });
    return NextResponse.json(updatePost(id, { content_json: merged }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
