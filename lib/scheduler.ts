import cron, { type ScheduledTask } from "node-cron";
import { db, initSchema, getPostById, updatePost } from "./db";
import { publishPost } from "./publish";
import { notify } from "./notify";
import { checkTokenExpiry } from "./tokens";

/**
 * node-cron scheduler for recurring in-server jobs:
 *   - publish-due-posts: really publishes approved+scheduled posts (LinkedIn +
 *     Instagram) via lib/publish, with retries and notifications.
 *   - token-expiry-check: daily warning / auto-refresh (lib/tokens).
 *
 * Recurring content-GENERATION tasks (the Tasks page) run in the standalone
 * process: `npm run scheduler` (scripts/scheduler.js), which also calls
 * /api/init on every sync to start these jobs.
 *
 * Next.js can evaluate modules more than once, so we guard with a global
 * flag to avoid registering duplicate cron jobs.
 */
const globalForCron = globalThis as unknown as {
  _cronStarted?: boolean;
  _cronJobs?: ScheduledTask[];
};

const jobs: ScheduledTask[] = globalForCron._cronJobs ?? [];

const TZ = "Asia/Kolkata";
const MAX_PUBLISH_ATTEMPTS = 3;

function register(
  expression: string,
  name: string,
  fn: () => void | Promise<void>
): void {
  if (!cron.validate(expression)) {
    console.warn(`[scheduler] invalid cron expression for ${name}: ${expression}`);
    return;
  }
  const task = cron.schedule(
    expression,
    () => {
      Promise.resolve()
        .then(fn)
        .catch((err) => console.error(`[scheduler] job "${name}" failed:`, err));
    },
    { timezone: TZ }
  );
  jobs.push(task);
  console.log(`[scheduler] registered "${name}" (${expression} ${TZ})`);
}

// A carousel publish can outlast the 5-minute interval. Without this flag the
// next tick would pick up the same still-approved post and publish it twice.
let publishRunning = false;

async function publishDuePosts(): Promise<void> {
  if (publishRunning) return;
  publishRunning = true;
  try {
    await publishDueBatch();
  } finally {
    publishRunning = false;
  }
}

/** Publish any approved posts whose scheduled_for time has passed — for real. */
async function publishDueBatch(): Promise<void> {
  initSchema();
  const due = db
    .prepare(
      `SELECT id FROM posts
       WHERE status = 'approved'
         AND scheduled_for IS NOT NULL
         AND scheduled_for <= datetime('now')`
    )
    .all() as { id: number }[];

  for (const { id } of due) {
    const post = getPostById(id);
    if (!post) continue;
    const meta = post.content_json ? JSON.parse(post.content_json) : {};
    const attempts = Number(meta.publishAttempts || 0);

    try {
      const published = await publishPost(id);
      const link = post.platform === "instagram" ? "/instagram" : "/linkedin";
      await notify({
        level: "success",
        title: `Scheduled ${post.platform} post published — ${post.topic || `#${id}`}`,
        body: `Post #${id} went live as scheduled.`,
        link,
        email: true,
      });
      void published;
    } catch (e) {
      const msg = (e as Error).message;
      const nextAttempts = attempts + 1;
      const gaveUp = nextAttempts >= MAX_PUBLISH_ATTEMPTS;

      updatePost(id, {
        content_json: JSON.stringify({
          ...meta,
          publishAttempts: nextAttempts,
          lastPublishError: msg,
        }),
        // After the final failed attempt, unschedule so it stops retrying;
        // the post stays 'approved' for a manual publish.
        ...(gaveUp ? { scheduled_for: null } : {}),
      });

      await notify({
        level: "error",
        title: gaveUp
          ? `Scheduled publish FAILED after ${MAX_PUBLISH_ATTEMPTS} attempts — post #${id}`
          : `Scheduled publish failed (attempt ${nextAttempts}/${MAX_PUBLISH_ATTEMPTS}) — post #${id}`,
        body: gaveUp ? `${msg} — unscheduled; publish manually when fixed.` : msg,
        link: post.platform === "instagram" ? "/instagram" : "/linkedin",
      });
      console.error(`[scheduler] publish #${id} failed (${nextAttempts}):`, msg);
    }
  }
}

/**
 * Start all scheduled jobs. Idempotent.
 * Call once from server startup (e.g. an instrumentation hook or an API route).
 */
export function startScheduler(): void {
  if (globalForCron._cronStarted) return;
  globalForCron._cronStarted = true;
  globalForCron._cronJobs = jobs;

  // Check for due posts every 5 minutes; retry window follows from this.
  register("*/5 * * * *", "publish-due-posts", publishDuePosts);

  // Daily 9am IST: token expiry warnings / Meta auto-refresh.
  register("0 9 * * *", "token-expiry-check", checkTokenExpiry);

  console.log("[scheduler] started");
}

/** Stop and clear all jobs. */
export function stopScheduler(): void {
  for (const j of jobs) j.stop();
  jobs.length = 0;
  globalForCron._cronStarted = false;
}
