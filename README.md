<div align="center">

# ⬤ Opsphere

**One dashboard that runs the business side of a dev agency — AI content,
scheduled publishing, lead gen and outreach.**

Built by DK @ **Mirasphere Digital** · Gurgaon ·
serving UK & Indian clients (WordPress · Elementor · Shopify · React · SEO)

`Next.js 14` · `TypeScript` · `SQLite` · `Gemini` · `LinkedIn API` · `Instagram Graph API`

</div>

---

## What it does

| Module | Status | What you get |
|---|---|---|
| 📸 **Instagram studio** | ✅ Live | Topic → 6-slide branded carousel (AI copy + AI background), rendered at 1080×1350, one-click **publish or schedule** to Instagram |
| 💼 **LinkedIn pipeline** | ✅ Live | Topic → live-web research brief → drafted post → image → publish (text or image posts), OAuth built in |
| ⏰ **Tasks & automation** | ✅ Live | Cron-driven content generation (e.g. "carousel every weekday 7am IST"), run history, in-app + email notifications |
| 🛡️ **Token lifecycle** | ✅ Live | Daily expiry check, warnings 10 days out, Meta token **auto-refresh** |
| 💬 **Command chat** | ✅ Live | Gemini assistant that runs dashboard actions and debugs the app itself |
| 🎯 **Leads** | 🔜 Phase 3 | Scrape UK/India agency directories, enrich emails via Hunter.io |
| ✉️ **Outreach** | 🔜 Phase 4 | AI-personalised cold email drafting, review queue, capped sending |

## Quick start

```bash
npm install            # needs a C/C++ toolchain for better-sqlite3 (see below)
cp .env.local.example .env.local   # fill in your keys
npm run db:init        # create + seed the SQLite database
npm run dev            # dashboard on http://localhost:3000
npm run scheduler      # (separate terminal) cron runner for recurring tasks
```

`npm run scheduler` also starts the in-server jobs (scheduled publishing and
the daily token check) and restarts them within 5 minutes of a dev-server
restart. Without it, POST `http://localhost:3000/api/init` after each server
start. Opening the dashboard does not start them.

### Native module prerequisites

`better-sqlite3` and (optional) `canvas` compile natively:

- **Windows** — Visual Studio Build Tools, "Desktop development with C++"
- **macOS** — `xcode-select --install`
- **Debian/Ubuntu** — `sudo apt-get install -y build-essential`

## Configuration (`.env.local`)

| Key | Needed for |
|---|---|
| `GEMINI_API_KEY` | All AI generation (copy, research, chat) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | One-time OAuth at `/api/linkedin/auth` |
| `LINKEDIN_ACCESS_TOKEN` / `LINKEDIN_PERSON_URN` | LinkedIn publishing |
| `META_USER_ID` / `META_ACCESS_TOKEN` | Instagram publishing |
| `META_APP_ID` / `META_APP_SECRET` | *Optional:* Meta token auto-refresh + exact expiry tracking |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` | Public image URLs for the Instagram Graph API |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `PREVIEW_EMAIL` | Notification + (Phase 4) outreach email |
| `HUNTER_API_KEY` | (Phase 3) lead email enrichment |
| `IMAGE_API_URL` / `META_GRAPH_VERSION` | Optional overrides |

Step-by-step account setup (Meta app, long-lived tokens, Cloudinary unsigned
preset): **[PHASE1-SETUP.md](PHASE1-SETUP.md)** · Manual checklist:
**[DK-TODO.md](DK-TODO.md)**

## How publishing works

**Instagram** — slides render client-side on canvas (exactly what you preview
is what ships), get saved server-side, uploaded to Cloudinary for public URLs,
then pushed through the Graph API container flow (item containers → carousel
container → publish), with status polling at each step.

**LinkedIn** — text posts via `ugcPosts`; image posts via
`registerUpload → upload → ugcPost`.

**Scheduling** — mark a post *approved* with a time (or use the Schedule
button on a carousel). An in-server cron checks every 5 minutes, publishes via
the same code path as the button, retries up to 3× on failure, then
unschedules and emails you rather than failing silently.

**Tokens** — LinkedIn and Meta tokens last ~60 days. A daily 9am IST job
warns 10 days before expiry; with `META_APP_ID`/`META_APP_SECRET` set, the
Meta token refreshes itself.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `start` | Production build / serve |
| `npm run db:init` | Create + seed SQLite (`data/leads.db`) |
| `npm run scheduler` | Standalone cron runner for Tasks-page jobs |
| `npm run seed` | Seed sample data |

## Project structure

```
app/
  page.tsx               Dashboard (stats overview)
  instagram/ linkedin/   Content studios
  tasks/ messages/       Automation + notification centre
  chat/                  Command chat (Gemini, streaming, action blocks)
  settings/              Integrations (live connectivity tests), brand, tone
  api/                   posts, tasks, messages, settings, linkedin OAuth,
                         chat, health, debug, init
components/              CarouselStudio, PostComposer, Sidebar, Topbar, MicButton
lib/
  db.ts                  SQLite schema + typed helpers
  gemini.ts              Gemini wrapper (text / JSON / grounded search / stream)
  publish.ts             Shared publish logic (button + cron use the same path)
  meta.ts  linkedin.ts   Platform APIs
  imagehost.ts           Cloudinary unsigned uploads
  scheduler.ts tokens.ts In-server cron + token lifecycle
  tasks.ts notify.ts     Task runner + notifications (in-app & email)
scripts/scheduler.js     Standalone cron process for recurring generation
data/                    SQLite database (git-ignored)
```

## Security notes

- `.env.local`, the database and generated images are **git-ignored** — never
  commit real keys.
- This app has **no authentication**: it is designed to run locally.
  Do not expose it to the public internet as-is; add auth first (planned
  alongside cloud deployment).

## Roadmap

Phases 1–2 shipped (Instagram publishing, real scheduler, token lifecycle).
Phase 3 = Leads · Phase 4 = Outreach · Phase 5 = polish & analytics.
