// Standalone DB initialiser (run via `npm run db:init`).
// Creates /data/leads.db with the full schema using better-sqlite3.
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
    platform      TEXT NOT NULL CHECK (platform IN ('instagram','linkedin')),
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

const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get();
if (count.n === 0) {
  const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  const seed = db.transaction((rows) => {
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

console.log("Database initialised at", DB_PATH);
console.log("Tables:", db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name).join(", "));
db.close();
