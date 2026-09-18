import { NextResponse } from "next/server";
import { getGemini, DEFAULT_MODEL } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/transcribe  (multipart form, field "audio") -> { text }
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("audio") as File | null;
    if (!file) {
      return NextResponse.json({ error: "audio file required" }, { status: 400 });
    }
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mimeType = file.type || "audio/ogg";

    const ai = getGemini();
    const res = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text:
                "Transcribe this audio verbatim. Return ONLY the transcript " +
                "text with no commentary, labels, or quotes.",
            },
          ],
        },
      ],
      config: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    } as never);

    const text = (res.text ?? "").trim();
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
