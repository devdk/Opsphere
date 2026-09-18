import {
  updateTask,
  recordTaskRun,
  type Task,
} from "./db";
import { notify } from "./notify";

const IG_TOPICS = [
  "WordPress speed tips",
  "SEO myths debunked",
  "client red flags to avoid",
  "Shopify vs WooCommerce",
  "agency pricing transparency",
  "web dev tools I rely on",
  "portfolio showcase",
];
const LI_TOPICS = [
  "Elementor performance optimization",
  "headless Shopify for UK retailers",
  "technical SEO wins for small businesses",
  "React vs WordPress for client sites",
  "what UK clients want from a web partner",
];

function rotate(arr: string[]): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const day = Math.floor((Date.now() - start) / 86400000);
  return arr[day % arr.length];
}

/**
 * Execute a task: generate content via the local API, record the run, and
 * raise an in-app + email notification. Used by both "Run now" and the cron
 * scheduler (which call the /api/tasks/[id]/run route).
 */
export async function runTask(task: Task, origin: string): Promise<{ id: number }> {
  const now = new Date().toISOString();
  updateTask(task.id, { last_status: "running" });

  const isIG = task.action === "generate_instagram";
  const topic =
    task.topic && task.topic.trim()
      ? task.topic.trim()
      : rotate(isIG ? IG_TOPICS : LI_TOPICS);

  try {
    const endpoint = isIG
      ? "/api/posts/generate-carousel"
      : "/api/posts/generate";
    const body = isIG ? { topic } : { platform: "linkedin", topic };

    const res = await fetch(`${origin}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let data: { id?: number; error?: string } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw.slice(0, 200) || "empty response");
    }
    if (!res.ok) throw new Error(data.error || `generate failed (${res.status})`);

    const label = isIG ? "Instagram carousel" : "LinkedIn post";
    const link = isIG ? "/instagram" : "/linkedin";
    updateTask(task.id, {
      last_status: "success",
      last_run_at: now,
      last_detail: `Created #${data.id} — ${topic}`,
    });
    recordTaskRun(task.id, "success", `#${data.id} — ${topic}`);
    await notify({
      level: "success",
      title: `${label} ready — ${topic}`,
      body: `Draft #${data.id} generated and waiting for review.`,
      link,
      email: true,
    });
    return { id: data.id as number };
  } catch (e) {
    const msg = (e as Error).message;
    updateTask(task.id, {
      last_status: "error",
      last_run_at: now,
      last_detail: msg,
    });
    recordTaskRun(task.id, "error", msg);
    await notify({
      level: "error",
      title: `Task failed — ${task.name}`,
      body: msg,
      link: "/tasks",
    });
    throw e;
  }
}
