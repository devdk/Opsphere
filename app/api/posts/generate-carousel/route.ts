import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateJSON } from "@/lib/gemini";
import { generatePostImage } from "@/lib/images";
import { createPost, updatePost } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Slide {
  title: string;
  body: string;
}

// POST /api/posts/generate-carousel  body: { topic, audience?, tone?, notes? }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      topic?: string;
      audience?: string;
      tone?: string;
      notes?: string;
    };
    if (!body.topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    const system =
      "You are a social media copywriter for DK, a full-stack web developer at " +
      "Mirasphere Digital (Gurgaon) serving UK and Indian clients on WordPress, " +
      "Elementor, Shopify, React and SEO. Voice: confident, friendly, no fluff.";

    const prompt =
      `Create an Instagram CAROUSEL about: ${body.topic}.` +
      (body.audience ? ` Audience: ${body.audience}.` : "") +
      (body.tone ? ` Tone: ${body.tone}.` : "") +
      (body.notes && body.notes.trim()
        ? `\nWeave in these points faithfully:\n${body.notes.trim()}`
        : "") +
      `\nReturn JSON: { "slides": [{ "title": string, "body": string }], ` +
      `"caption": string, "hashtags": string[] }. ` +
      `Make exactly 6 slides: slide 1 a scroll-stopping hook, slides 2-5 punchy ` +
      `value points, slide 6 a clear call-to-action. Keep each title under 60 ` +
      `chars and each body under 160 chars. Caption has line breaks, no hashtags ` +
      `inside. 5-8 relevant hashtags WITHOUT the # sign.`;

    const out = await generateJSON<{
      slides: Slide[];
      caption: string;
      hashtags: string[];
    }>(prompt, { system, maxTokens: 2048 });

    const slides = (out.slides || [])
      .slice(0, 8)
      .map((s) => ({ title: String(s.title || ""), body: String(s.body || "") }));
    const hashtags = (out.hashtags || [])
      .map((h: string) => "#" + String(h).replace(/^#/, "").trim())
      .filter((h: string) => h.length > 1)
      .join(" ");

    // Persist first to get an id for the background filename.
    const post = createPost({
      platform: "instagram",
      topic: body.topic,
      audience: body.audience,
      caption: out.caption,
      hashtags,
      content_json: JSON.stringify({ type: "carousel", slides }),
    });

    // One cohesive AI background, reused across slides with the text overlay.
    let bgPath: string | null = null;
    let imageProvider: string | undefined;
    let imageError: string | undefined;
    const bgPrompt =
      `Artistic, catchy, hand-drawn sketch-style abstract background inspired by ` +
      `"${body.topic}". Dark moody palette with subtle lime-green accents, loose ` +
      `ink line-art, lots of negative space, modern. No text, no words, no letters.`;
    try {
      const img = await generatePostImage(bgPrompt);
      const dir = path.join(process.cwd(), "public", "generated");
      fs.mkdirSync(dir, { recursive: true });
      const ext = img.mimeType.includes("png") ? "png" : "jpg";
      const file = `ig-${post.id}.${ext}`;
      fs.writeFileSync(path.join(dir, file), Buffer.from(img.base64, "base64"));
      bgPath = `/generated/${file}`;
      imageProvider = img.provider;
    } catch (e) {
      imageError = (e as Error).message;
    }

    const updated = updatePost(post.id, {
      content_json: JSON.stringify({
        type: "carousel",
        slides,
        bgPath,
        imageProvider,
        imageError,
        bgPrompt,
      }),
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
