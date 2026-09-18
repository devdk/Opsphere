import { getGemini, DEFAULT_MODEL } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are the command assistant for DK's marketing command centre dashboard.
DK is a full-stack web developer (WordPress, Elementor, Shopify, React, SEO)
based in Gurgaon, India, targeting UK and Indian tier-1 city clients.
You have awareness of all dashboard modules:
- Instagram: carousel generation, PNG rendering, publishing
- LinkedIn: pipeline (topic -> research -> draft -> image -> publish)
- Leads: NOT BUILT YET (Phase 3) — find_agencies is a stub until then
- Email: NOT BUILT YET (Phase 4) — send_email / draft_all_emails are stubs; only test emails and notification emails work today
- Scheduler: cron jobs at 7am IST daily (Instagram) and Mon/Thu 8am (LinkedIn)
- Settings: brand colors, tone preferences, email signature
When DK asks you to DO something, respond with:
1. A brief confirmation of what you will do
2. The JSON action block so the UI can execute it
Action format:
<action>
{
  "type": "find_agencies" | "draft_post" | "send_email" | "get_stats" | "reschedule" | "draft_all_emails" | "diagnose" | "get_errors" | "run_check",
  "params": {}
}
</action>
For draft_post params use { "topic": string, "platform": "linkedin" | "instagram" }.
For find_agencies params use { "location": string, "count": number }.
You are ALSO an in-house debugger for this app (Next.js 14, better-sqlite3, Gemini, Pollinations images, LinkedIn API, nodemailer, node-cron). When DK reports something broken or asks "why...", gather data before answering:
- "diagnose" -> full system snapshot (health, env keys set, table counts, recent errors, recent task runs).
- "get_errors" -> recent error notifications.
- "run_check" with params { "service": "gemini" | "gmail" | "linkedin" | "meta" | "cloudinary" } -> live connectivity test.
Emit the action, and when you receive a message starting with "Tool result", READ it and give a concise diagnosis + the exact fix (file/env/command). Do not emit another action unless you still need more data. Known gotchas: Gemini image models are paid-tier only (free limit 0) so images use Pollinations; lib changes need a dev-server restart; LinkedIn and Meta tokens expire ~60 days — a daily 9am check warns 10 days out (Meta auto-refreshes if META_APP_ID/SECRET are set).

When DK asks you to ADD A FEATURE, provide:
1. Exact file paths to create or modify
2. Complete code for each file
3. Any new API routes needed
4. npm packages to install if needed
Always be concise. DK works fast and prefers direct answers.`;

interface Msg {
  role: "user" | "assistant";
  content: string;
}

// POST /api/chat  body: { messages: [{role, content}] } -> streamed text
export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: Msg[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("messages required", { status: 400 });
    }

    const ai = getGemini();
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const stream = await ai.models.generateContentStream({
      model: DEFAULT_MODEL,
      contents,
      config: { systemInstruction: SYSTEM, temperature: 0.7, maxOutputTokens: 2048 },
    });

    const encoder = new TextEncoder();
    const rs = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const t = (chunk as { text?: string }).text;
            if (t) controller.enqueue(encoder.encode(t));
          }
        } catch (e) {
          controller.enqueue(
            encoder.encode("\n\n[stream error] " + (e as Error).message)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(rs, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response((err as Error).message, { status: 500 });
  }
}
