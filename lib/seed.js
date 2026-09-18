// Seed: create DB schema + sample settings. Run with `npm run seed`.
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "leads.db");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, location TEXT, website TEXT,
    email TEXT, agency_type TEXT, region TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','drafted','sent','replied')),
    email_subject TEXT, email_body TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), sent_at TEXT);
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL CHECK (platform IN ('instagram','linkedin')),
    topic TEXT, audience TEXT, content_json TEXT, caption TEXT, hashtags TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','published')),
    scheduled_for TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), published_at TEXT);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);

const defaults = {
  tone: "semi-formal",
  brand_accent: "#c8f542",
  brand_bg: "#0f0f0f",
  owner_name: "DK",
  agency: "Mirasphere Digital",
  ig_audience: "UK and Indian tier-1 small-business owners",
};
const upsert = db.prepare(
  "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING"
);
const tx = db.transaction((obj) => {
  for (const [k, v] of Object.entries(obj)) upsert.run(k, v);
});
tx(defaults);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'generate_linkedin', topic TEXT,
    cron TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    enabled INTEGER NOT NULL DEFAULT 1, builtin INTEGER NOT NULL DEFAULT 0,
    last_run_at TEXT, last_status TEXT, last_detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS task_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, status TEXT, detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'notification',
    level TEXT NOT NULL DEFAULT 'info', title TEXT NOT NULL, body TEXT, link TEXT,
    recipient TEXT, is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

if (db.prepare("SELECT COUNT(*) AS n FROM tasks").get().n === 0) {
  const it = db.prepare(
    "INSERT INTO tasks (name, action, topic, cron, timezone, enabled, builtin) VALUES (?,?,?,?,?,1,1)"
  );
  it.run("Instagram carousel — daily 7am IST", "generate_instagram", null, "0 7 * * *", "Asia/Kolkata");
  it.run("LinkedIn post — Mon & Thu 8am IST", "generate_linkedin", null, "0 8 * * 1,4", "Asia/Kolkata");
}

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all()
  .map((r) => r.name);
console.log("DB seeded at", DB_PATH);
console.log("Tables:", tables.join(", "));
console.log(
  "Settings:",
  db.prepare("SELECT COUNT(*) n FROM settings").get().n,
  "rows"
);
db.close();
