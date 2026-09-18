import { GoogleGenAI } from "@google/genai";

/**
 * Lazily-instantiated Google Gen AI (Gemini) client.
 */
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GenerateOptions {
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * One-shot text generation.
 * Thinking is disabled so the full output budget goes to the answer (2.5-flash
 * is a thinking model and can otherwise consume the budget and return empty).
 */
export async function generateText(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return (res.text ?? "").trim();
}

/**
 * Generate JSON from Gemini, robustly.
 * - disables thinking + uses a generous token budget so output isn't truncated
 * - asks for application/json
 * - defensively extracts/parses the JSON and gives clear errors
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<T> {
  const system =
    (opts.system ? opts.system + "\n\n" : "") +
    "Respond with ONLY valid JSON. No markdown fences, no commentary.";

  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
    },
  });

  const raw = (res.text ?? "").trim();
  if (!raw) {
    const reason =
      (res as unknown as { candidates?: { finishReason?: string }[] })
        .candidates?.[0]?.finishReason || "unknown";
    throw new Error(
      `Gemini returned an empty response (finishReason: ${reason}). ` +
        "Try again, or shorten the topic."
    );
  }

  let cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  // If the model wrapped JSON in prose, extract the JSON span.
  const span = cleaned.match(/[[{][\s\S]*[\]}]/);
  if (span) cleaned = span[0];

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      "Could not parse JSON from Gemini. First 200 chars: " +
        cleaned.slice(0, 200)
    );
  }
}

// ---- Grounded research (Google Search) -----------------------------------

export interface Source {
  title: string;
  uri: string;
}

/** Generate text grounded in live Google Search results, with cited sources. */
export async function generateGrounded(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<{ text: string; sources: Source[] }> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.6,
      maxOutputTokens: opts.maxTokens ?? 2048,
      tools: [{ googleSearch: {} }],
    },
  });

  const text = (res.text ?? "").trim();
  const sources: Source[] = [];
  const meta = (res as unknown as {
    candidates?: { groundingMetadata?: { groundingChunks?: unknown[] } }[];
  }).candidates?.[0]?.groundingMetadata;
  for (const chunk of meta?.groundingChunks ?? []) {
    const web = (chunk as { web?: { uri?: string; title?: string } }).web;
    if (web?.uri) sources.push({ title: web.title ?? web.uri, uri: web.uri });
  }
  return { text, sources };
}

// ---- Image generation -----------------------------------------------------

export const IMAGE_MODEL = "gemini-2.5-flash-image";

export type AspectRatio = "1:1" | "1.91:1" | "4:5";

export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = "1:1"
): Promise<{ base64: string; mimeType: string }> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  } as never);

  const parts =
    (res as unknown as {
      candidates?: { content?: { parts?: unknown[] } }[];
    }).candidates?.[0]?.content?.parts ?? [];

  for (const p of parts) {
    const inline = (p as { inlineData?: { data?: string; mimeType?: string } })
      .inlineData;
    if (inline?.data) {
      return { base64: inline.data, mimeType: inline.mimeType ?? "image/png" };
    }
  }
  throw new Error("The model did not return an image.");
}
