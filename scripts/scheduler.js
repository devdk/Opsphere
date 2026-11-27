/*
 * Standalone scheduler. Run in its own process:  npm run scheduler
 * Reads tasks from the app DB (via the running web server) and fires each
 * enabled task on its cron schedule by calling /api/tasks/:id/run, which does
 * the generation + notification + email.
 *
 * Each sync also POSTs /api/init, which starts the web server's own cron
 * (scheduled publishing + daily token check). It is idempotent, and repeating
 * it every sync restarts that cron after a dev-server restart.
 *
 * Requires the Next server running.  Run a task once:  node scripts/scheduler.js --test
 */
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

// ---- load .env.local -----------------------------------------------------
(function loadEnv() {
  const f = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const BASE = process.env.APP_URL || "http://localhost:3000";
let jobs = [];

async function startServerCron() {
  try {
    const res = await fetch(`${BASE}/api/init`, { method: "POST" });
    if (!res.ok) throw new Error(`POST /api/init ${res.status}`);
  } catch (e) {
    console.error(`[scheduler] could not start the server's publish cron (${e.message}). Retrying next sync.`);
  }
}

async function fetchTasks() {
  const res = await fetch(`${BASE}/api/tasks`);
  if (!res.ok) throw new Error(`GET /api/tasks ${res.status}`);
  return res.json();
}

async function fire(task) {
  console.log(`[scheduler] firing "${task.name}" (#${task.id})`);
  try {
    const res = await fetch(`${BASE}/api/tasks/${task.id}/run`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) console.log(`[scheduler] ok — post #${d.id}`);
    else console.error(`[scheduler] task ${task.id} failed: ${d.error || res.status}`);
  } catch (e) {
    console.error(`[scheduler] task ${task.id} error: ${e.message}`);
  }
}

async function sync() {
  await startServerCron();
  let tasks;
  try {
    tasks = await fetchTasks();
  } catch (e) {
    console.error(`[scheduler] could not load tasks (${e.message}). Is the web server running? Retrying in 5 min.`);
    return;
  }
  jobs.forEach((j) => j.stop());
  jobs = [];
  let count = 0;
  for (const t of tasks) {
    if (!t.enabled) continue;
    if (!cron.validate(t.cron)) {
      console.warn(`[scheduler] invalid cron for "${t.name}": ${t.cron}`);
      continue;
    }
    const job = cron.schedule(t.cron, () => fire(t), {
      timezone: t.timezone || "Asia/Kolkata",
    });
    jobs.push(job);
    count++;
  }
  console.log(`[scheduler] synced — ${count} enabled task(s) scheduled.`);
}

// ---- one-off test --------------------------------------------------------
if (process.argv[2] === "--test") {
  fetchTasks()
    .then((tasks) => {
      const t = tasks.find((x) => x.enabled) || tasks[0];
      if (!t) throw new Error("no tasks found");
      return fire(t);
    })
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
} else {
  console.log(`[scheduler] starting — target ${BASE}`);
  sync();
  setInterval(sync, 5 * 60 * 1000); // re-sync every 5 min to pick up changes
}
