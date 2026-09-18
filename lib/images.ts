import { generateImage } from "./gemini";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
  provider: string;
}

// Free, keyless image API (Pollinations / Flux). Overridable via env.
const FREE_IMAGE_BASE =
  process.env.IMAGE_API_URL || "https://image.pollinations.ai/prompt";

/** Generate a square image from a free provider. No API key required. */
export async function generateFreeImage(
  prompt: string,
  size = 1200
): Promise<GeneratedImage> {
  const url =
    `${FREE_IMAGE_BASE}/${encodeURIComponent(prompt)}` +
    `?width=${size}&height=${size}&nologo=true&model=flux`;

  // Pollinations renders on demand and can be slow; allow up to 90s.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(
      `free image provider failed: ${res.status} ${await res
        .text()
        .catch(() => "")}`.trim()
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) {
    throw new Error("free image provider returned an invalid/empty image");
  }
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  return { base64: buf.toString("base64"), mimeType, provider: "pollinations" };
}

/**
 * Generate a post image. Uses the free provider first (DK's choice), and
 * automatically falls back to Gemini if the free provider fails.
 */
export async function generatePostImage(prompt: string): Promise<GeneratedImage> {
  try {
    return await generateFreeImage(prompt);
  } catch (freeErr) {
    try {
      const g = await generateImage(prompt, "1:1");
      return { ...g, provider: "gemini" };
    } catch {
      throw freeErr; // surface the original (free-provider) error
    }
  }
}
