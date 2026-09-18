import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getPostById, updatePost } from "@/lib/db";
import { generatePostImage } from "@/lib/images";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/posts/:id/regenerate-image -> re-rolls only the image.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const post = getPostById(id);
    if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });

    const meta = post.content_json ? JSON.parse(post.content_json) : {};
    const prompt =
      meta.imagePrompt ||
      `Artistic, catchy, hand-drawn sketch-style illustration about "${post.topic}". ` +
        `Loose ink line-art with energetic strokes and a few bold color accents, ` +
        `modern, eye-catching. No text, no words, no letters.`;

    const img = await generatePostImage(prompt);
    const dir = path.join(process.cwd(), "public", "generated");
    fs.mkdirSync(dir, { recursive: true });
    const ext = img.mimeType.includes("png") ? "png" : "jpg";
    const file = `li-${id}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(img.base64, "base64"));

    const merged = JSON.stringify({
      ...meta,
      imagePath: `/generated/${file}`,
      imageProvider: img.provider,
      imagePrompt: prompt,
      imageError: undefined,
    });
    return NextResponse.json(updatePost(id, { content_json: merged }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
