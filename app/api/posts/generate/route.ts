import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateJSON } from "@/lib/gemini";
import { generatePostImage } from "@/lib/images";
import { researchTopic } from "@/lib/research";
import { createPost, updatePost, type PostPlatform } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // research + writing + image can take a while

// POST /api/posts/generate  body: { topic, audience?, tone?, platform? }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      topic?: string;
      audience?: string;
      tone?: string;
      notes?: string;
      platform?: string;
    };
    if (!body.topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }
    const platform: PostPlatform =
      body.platform === "instagram" ? "instagram" : "linkedin";

    // 1) Research what works (Google Search grounded). Best-effort.
    let brief = "";
    let sources: { title: string; uri: string }[] = [];
    try {
      const r = await researchTopic(body.topic, body.audience);
      brief = r.brief;
      sources = r.sources;
    } catch {
      brief = "";
    }

    // 2) Write an ORIGINAL post applying the winning patterns.
    const system =
      "You are a social media copywriter for DK, a full-stack web developer at " +
      "Mirasphere Digital (Gurgaon) serving UK and Indian clients on WordPress, " +
      "Elementor, Shopify, React and SEO. Voice: confident, friendly, no fluff.";

    const prompt =
      `Write an ORIGINAL ${platform} post about: ${body.topic}.` +
      (body.audience ? ` Audience: ${body.audience}.` : "") +
      (body.tone ? ` Tone: ${body.tone}.` : "") +
      (body.notes && body.notes.trim()
        ? `\n\nThe author wants the following points/content woven into the ` +
          `post. Use them faithfully; if any is finished copy, you may lightly ` +
          `edit for flow:\n${body.notes.trim()}`
        : "") +
      (brief
        ? `\n\nApply the winning patterns from this engagement brief. Do NOT copy ` +
          `any example wording — produce fully original copy in DK's voice:\n${brief}`
        : "") +
      `\nReturn JSON with keys: "caption" (the post text with line breaks, no ` +
      `hashtags inside) and "hashtags" (array of 3-6 relevant tags WITHOUT the # sign).`;

    const out = await generateJSON<{ caption: string; hashtags: string[] }>(
      prompt,
      { system, maxTokens: 2048 }
    );
    const hashtags = (out.hashtags || [])
      .map((h: string) => "#" + String(h).replace(/^#/, "").trim())
      .filter((h: string) => h.length > 1)
      .join(" ");

    // 3) Persist the draft (so we have an id for the image filename).
    const post = createPost({
      platform,
      topic: body.topic,
      audience: body.audience,
      caption: out.caption,
      hashtags,
      content_json: JSON.stringify({ generatedBy: "gemini", brief, sources }),
    });

    // 4) Generate a square image (artistic / catchy / sketch). Best-effort.
    let imagePath: string | null = null;
    let imageError: string | undefined;
    const imagePrompt =
      `Artistic, catchy, hand-drawn sketch-style illustration about "${body.topic}". ` +
      `Loose ink line-art with energetic strokes and a few bold color accents, ` +
      `modern, eye-catching, clean balanced composition. No text, no words, no letters.`;
    let imageProvider: string | undefined;
    try {
      const img = await generatePostImage(imagePrompt);
      const dir = path.join(process.cwd(), "public", "generated");
      fs.mkdirSync(dir, { recursive: true });
      const ext = img.mimeType.includes("png") ? "png" : "jpg";
      const file = `li-${post.id}.${ext}`;
      fs.writeFileSync(
        path.join(dir, file),
        Buffer.from(img.base64, "base64")
      );
      imagePath = `/generated/${file}`;
      imageProvider = img.provider;
    } catch (e) {
      imageError = (e as Error).message;
    }

    const updated = updatePost(post.id, {
      content_json: JSON.stringify({
        generatedBy: "gemini",
        brief,
        sources,
        imagePath,
        imageProvider,
        imagePrompt,
        imageError,
      }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
