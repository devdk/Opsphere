import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Resolve the DB path to /data/leads.db at the project root.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "leads.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { _db?: Database.Database };

export const db: Database.Database =
  globalForDb._db ?? new Database(DB_PATH);

if (!globalForDb._db) {
  db.pragma("journal_mode = WAL");
  globalForDb._db = db;
}

/**
 * Create all tables if they do not already exist.
 * Safe to call on every startup.
 */
export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT,
      location      TEXT,
      website       TEXT,
      email         TEXT,
      agency_type   TEXT,
      region        TEXT,
      status        TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','drafted','sent','replied')),
      email_subject TEXT,
      email_body    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at       TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      platform      TEXT NOT NULL
                    CHECK (platform IN ('instagram','linkedin')),
      topic         TEXT,
      audience      TEXT,
      content_json  TEXT,
      caption       TEXT,
      hashtags      TEXT,
      status        TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','approved','published')),
      scheduled_for TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      published_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed a few default settings if the table is empty.
  const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
    n: number;
  };
  if (count.n === 0) {
    const insert = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?)"
    );
    const seed = db.transaction((rows: [string, string][]) => {
      for (const [k, v] of rows) insert.run(k, v);
    });
    seed([
      ["tone", "confident, friendly, no fluff"],
      ["brand_accent", "#c8f542"],
      ["brand_bg", "#0f0f0f"],
      ["owner_name", "DK"],
      ["agency", "Mirasphere Digital"],
    ]);
  }
}

// ---- Typed row helpers ---------------------------------------------------

export type LeadStatus = "new" | "drafted" | "sent" | "replied";
export type PostPlatform = "instagram" | "linkedin";
export type PostStatus = "draft" | "approved" | "published";

export interface Lead {
  id: number;
  name: string | null;
  location: string | null;
  website: string | null;
  email: string | null;
  agency_type: string | null;
  region: string | null;
  status: LeadStatus;
  email_subject: string | null;
  email_body: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface Post {
  id: number;
  platform: PostPlatform;
  topic: string | null;
  audience: string | null;
  content_json: string | null;
  caption: string | null;
  hashtags: string | null;
  status: PostStatus;
  scheduled_for: string | null;
  created_at: string;
  published_at: string | null;
}

export interface Setting {
  key: string;
  value: string | null;
}

// ---- Small query helpers used by the dashboard ---------------------------

export function getStats() {
  initSchema();
  const postsQueued = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM posts WHERE status IN ('draft','approved')"
      )
      .get() as { n: number }
  ).n;

  const emailsSentThisWeek = (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM leads WHERE status = 'sent' AND sent_at >= datetime('now','-7 days')"
      )
      .get() as { n: number }
  ).n;

  const leadsTotal = (
    db.prepare("SELECT COUNT(*) AS n FROM leads").get() as { n: number }
  ).n;

  return { postsQueued, emailsSentThisWeek, leadsTotal };
}

export function getSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string | null } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
// ---- Posts helpers -------------------------------------------------------

export interface NewPost {
  platform: PostPlatform;
  topic?: string;
  audience?: string;
  caption?: string;
  hashtags?: string;
  content_json?: string;
  status?: PostStatus;
  scheduled_for?: string;
}

export function createPost(p: NewPost): Post {
  initSchema();
  const info = db
    .prepare(
      `INSERT INTO posts (platform, topic, audience, content_json, caption, hashtags, status, scheduled_for)
       VALUES (@platform, @topic, @audience, @content_json, @caption, @hashtags, @status, @scheduled_for)`
    )
    .run({
      platform: p.platform,
      topic: p.topic ?? null,
      audience: p.audience ?? null,
      content_json: p.content_json ?? null,
      caption: p.caption ?? null,
      hashtags: p.hashtags ?? null,
      status: p.status ?? "draft",
      scheduled_for: p.scheduled_for ?? null,
    });
  return getPostById(Number(info.lastInsertRowid))!;
}

export function listPosts(platform?: PostPlatform): Post[] {
  initSchema();
  if (platform) {
    return db
      .prepare(
        "SELECT * FROM posts WHERE platform = ? ORDER BY datetime(created_at) DESC, id DESC"
      )
      .all(platform) as Post[];
  }
  return db
    .prepare("SELECT * FROM posts ORDER BY datetime(created_at) DESC, id DESC")
    .all() as Post[];
}

export function getPostById(id: number): Post | undefined {
  return db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as
    | Post
    | undefined;
}

export function updatePost(
  id: number,
  fields: Partial<
    Pick<
      Post,
      | "caption"
      | "hashtags"
      | "status"
      | "content_json"
      | "scheduled_for"
      | "topic"
      | "audience"
    >
  >
): Post | undefined {
  const allowed = [
    "caption",
    "hashtags",
    "status",
    "content_json",
    "scheduled_for",
    "topic",
    "audience",
  ] as const;
  const sets: string[] = [];
  const vals: Record<string, unknown> = { id };
  for (const k of allowed) {
    const v = fields[k];
    if (v !== undefined) {
      sets.push(`${k} = @${k}`);
      vals[k] = v;
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE posts SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  }
  return getPostById(id);
}

export function deletePost(id: number): void {
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function markPublished(id: number, content_json?: string): Post | undefined {
  db.prepare(
    "UPDATE posts SET status = 'published', published_at = datetime('now'), content_json = COALESCE(?, content_json) WHERE id = ?"
  ).run(content_json ?? null, id);
  return getPostById(id);
}
// ---- Operations: tasks + messages ---------------------------------------

export interface Task {
  id: number;
  name: string;
  action: string; // generate_linkedin | generate_instagram
  topic: string | null;
  cron: string;
  timezone: string;
  enabled: number;
  builtin: number;
  last_run_at: string | null;
  last_status: string | null;
  last_detail: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  kind: string; // notification | email | alert | system
  level: string; // info | success | warning | error
  title: string;
  body: string | null;
  link: string | null;
  recipient: string | null;
  is_read: number;
  created_at: string;
}

let opsReady = false;
export function ensureOps(): void {
  if (opsReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      action      TEXT NOT NULL DEFAULT 'generate_linkedin',
      topic       TEXT,
      cron        TEXT NOT NULL,
      timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      enabled     INTEGER NOT NULL DEFAULT 1,
      builtin     INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      last_status TEXT,
      last_detail TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS task_runs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id    INTEGER,
      status     TEXT,
      detail     TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      kind       TEXT NOT NULL DEFAULT 'notification',
      level      TEXT NOT NULL DEFAULT 'info',
      title      TEXT NOT NULL,
      body       TEXT,
      link       TEXT,
      recipient  TEXT,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const n = (db.prepare("SELECT COUNT(*) AS n FROM tasks").get() as { n: number }).n;
  if (n === 0) {
    const ins = db.prepare(
      `INSERT INTO tasks (name, action, topic, cron, timezone, enabled, builtin)
       VALUES (@name, @action, @topic, @cron, @timezone, 1, 1)`
    );
    ins.run({
      name: "Instagram carousel — daily 7am IST",
      action: "generate_instagram",
      topic: null,
      cron: "0 7 * * *",
      timezone: "Asia/Kolkata",
    });
    ins.run({
      name: "LinkedIn post — Mon & Thu 8am IST",
      action: "generate_linkedin",
      topic: null,
      cron: "0 8 * * 1,4",
      timezone: "Asia/Kolkata",
    });
  }
  opsReady = true;
}

// ---- tasks helpers ----

export interface NewTask {
  name: string;
  action?: string;
  topic?: string | null;
  cron: string;
  timezone?: string;
  enabled?: number;
}

export function createTask(t: NewTask): Task {
  ensureOps();
  const info = db
    .prepare(
      `INSERT INTO tasks (name, action, topic, cron, timezone, enabled, builtin)
       VALUES (@name, @action, @topic, @cron, @timezone, @enabled, 0)`
    )
    .run({
      name: t.name,
      action: t.action ?? "generate_linkedin",
      topic: t.topic ?? null,
      cron: t.cron,
      timezone: t.timezone ?? "Asia/Kolkata",
      enabled: t.enabled ?? 1,
    });
  return getTask(Number(info.lastInsertRowid))!;
}

export function listTasks(): Task[] {
  ensureOps();
  return db
    .prepare("SELECT * FROM tasks ORDER BY builtin DESC, id ASC")
    .all() as Task[];
}

export function getTask(id: number): Task | undefined {
  ensureOps();
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;
}

export function updateTask(
  id: number,
  fields: Partial<
    Pick<
      Task,
      | "name"
      | "action"
      | "topic"
      | "cron"
      | "timezone"
      | "enabled"
      | "last_run_at"
      | "last_status"
      | "last_detail"
    >
  >
): Task | undefined {
  ensureOps();
  const keys = [
    "name",
    "action",
    "topic",
    "cron",
    "timezone",
    "enabled",
    "last_run_at",
    "last_status",
    "last_detail",
  ] as const;
  const sets: string[] = [];
  const vals: Record<string, unknown> = { id };
  for (const k of keys) {
    const v = fields[k];
    if (v !== undefined) {
      sets.push(`${k} = @${k}`);
      vals[k] = v;
    }
  }
  if (sets.length) {
    db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = @id`).run(vals);
  }
  return getTask(id);
}

export function deleteTask(id: number): void {
  ensureOps();
  db.prepare("DELETE FROM tasks WHERE id = ? AND builtin = 0").run(id);
}

export function recordTaskRun(
  taskId: number,
  status: string,
  detail: string
): void {
  ensureOps();
  db.prepare(
    "INSERT INTO task_runs (task_id, status, detail) VALUES (?, ?, ?)"
  ).run(taskId, status, detail);
}

export function listTaskRuns(taskId: number, limit = 10): { status: string; detail: string; created_at: string }[] {
  ensureOps();
  return db
    .prepare(
      "SELECT status, detail, created_at FROM task_runs WHERE task_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(taskId, limit) as { status: string; detail: string; created_at: string }[];
}

// ---- messages helpers ----

export interface NewMessage {
  kind?: string;
  level?: string;
  title: string;
  body?: string | null;
  link?: string | null;
  recipient?: string | null;
}

export function createMessage(m: NewMessage): number {
  ensureOps();
  const info = db
    .prepare(
      `INSERT INTO messages (kind, level, title, body, link, recipient)
       VALUES (@kind, @level, @title, @body, @link, @recipient)`
    )
    .run({
      kind: m.kind ?? "notification",
      level: m.level ?? "info",
      title: m.title,
      body: m.body ?? null,
      link: m.link ?? null,
      recipient: m.recipient ?? null,
    });
  return Number(info.lastInsertRowid);
}

export function listMessages(filter?: string): Message[] {
  ensureOps();
  if (filter === "unread") {
    return db
      .prepare("SELECT * FROM messages WHERE is_read = 0 ORDER BY id DESC LIMIT 200")
      .all() as Message[];
  }
  if (filter === "errors") {
    return db
      .prepare("SELECT * FROM messages WHERE level = 'error' ORDER BY id DESC LIMIT 200")
      .all() as Message[];
  }
  if (filter === "email") {
    return db
      .prepare("SELECT * FROM messages WHERE kind = 'email' ORDER BY id DESC LIMIT 200")
      .all() as Message[];
  }
  return db
    .prepare("SELECT * FROM messages ORDER BY id DESC LIMIT 200")
    .all() as Message[];
}

export function unreadCount(): number {
  ensureOps();
  return (
    db.prepare("SELECT COUNT(*) AS n FROM messages WHERE is_read = 0").get() as {
      n: number;
    }
  ).n;
}

export function markMessageRead(id: number, read = true): void {
  ensureOps();
  db.prepare("UPDATE messages SET is_read = ? WHERE id = ?").run(read ? 1 : 0, id);
}

export function markAllRead(): void {
  ensureOps();
  db.prepare("UPDATE messages SET is_read = 1 WHERE is_read = 0").run();
}

export function deleteMessage(id: number): void {
  ensureOps();
  db.prepare("DELETE FROM messages WHERE id = ?").run(id);
}
