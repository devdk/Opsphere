import { generateGrounded, type Source } from "./gemini";

export interface EngagementBrief {
  brief: string;
  sources: Source[];
}

/**
 * Research what makes LinkedIn posts on a topic perform well, using live
 * Google Search grounding. Returns an analysis brief + cited sources.
 * Does NOT write the post itself.
 */
export async function researchTopic(
  topic: string,
  audience?: string
): Promise<EngagementBrief> {
  const system =
    "You are a LinkedIn content strategist. You analyze what makes posts on a " +
    "given topic perform well, citing real, current examples and sources.";

  const prompt =
    `Research what makes high-performing LinkedIn posts about "${topic}"` +
    (audience ? ` for an audience of ${audience}` : "") +
    `. Use current web sources. Produce a concise "engagement brief" covering:\n` +
    `- Hook patterns that win attention in the first 1-2 lines\n` +
    `- Ideal post structure and length for this topic\n` +
    `- Angles / sub-topics resonating right now\n` +
    `- Tone & formatting norms (line breaks, lists, emoji)\n` +
    `- An effective call-to-action style\n` +
    `- 5-8 relevant, currently-used hashtags\n` +
    `Be specific to "${topic}". Do NOT write the post itself.`;

  const { text, sources } = await generateGrounded(prompt, {
    system,
    maxTokens: 1600,
  });
  return { brief: text, sources };
}
