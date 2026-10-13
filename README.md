# Opsphere

Opsphere — an all-in-one ops dashboard for a full-stack web developer — generate
Instagram carousels and LinkedIn posts, scrape and manage leads, and draft and
send outreach emails, all from one place.

Built for DK @ **Mirasphere Digital**, Gurgaon (WordPress, Elementor, Shopify,
React & SEO work for UK and Indian clients).

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **better-sqlite3** — local database (`/data/leads.db`)
- **node-cron** — scheduler for publishing/outreach jobs
- **@google/genai** — AI generation (Google Gemini)
- **nodemailer** — email sending (Gmail SMTP)
- **canvas** (node-canvas) — image / carousel generation
- **puppeteer + cheerio** — web scraping for lead gen

## Prerequisites

- **Node.js 18.18+** (Node 20 LTS recommended)
- A C/C++ toolchain for native modules (`better-sqlite3`, `canvas`):
  - **Windows:** install the "Desktop development with C++" workload
    (Visual Studio Build Tools), which ships the required compiler. `puppeteer`
    downloads its own Chromium automatically.
  - **macOS:** `xcode-select --install`, plus
    `brew install pkg-config cairo pango libpng jpeg giflib librsvg` for `canvas`.
  - **Linux (Debian/Ubuntu):**
    `sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the example file and fill in your keys:

   ```bash
   cp .env.local.example .env.local
   ```

   | Key                   | What it's for                                            |
   | --------------------- | -------------------------------------------------------- |
   | `GEMINI_API_KEY`      | Google Gemini API key for AI generation                  |
   | `GMAIL_USER`          | Gmail address used to send outreach                      |
   | `GMAIL_APP_PASSWORD`  | Gmail **App Password** (not your account password)       |
   | `PREVIEW_EMAIL`       | Address that receives preview/test emails                |
   | `META_USER_ID`        | Instagram/Meta Graph API user id                         |
   | `META_ACCESS_TOKEN`   | Meta access token (publishing + status dot)              |
   | `LINKEDIN_ACCESS_TOKEN` | LinkedIn access token (publishing + status dot)        |
   | `HUNTER_API_KEY`      | Hunter.io key for finding lead emails                    |

3. **Initialise the database**

   ```bash
   npm run db:init
   ```

   This creates `/data/leads.db` with the `leads`, `posts` and `settings`
   tables and seeds default settings. The app also self-heals the schema on
   first request, so this step is optional but recommended.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

## Available scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start the dev server on port 3000        |
| `npm run build`   | Production build                         |
| `npm run start`   | Start the production server              |
| `npm run lint`    | Run Next.js ESLint                       |
| `npm run db:init` | Create/seed the SQLite database          |

## Project structure

```
command-centre/
├─ app/
│  ├─ layout.tsx            Root layout (sidebar + topbar + chat widget)
│  ├─ page.tsx              Dashboard home (stats overview)
│  ├─ globals.css           Tailwind + theme tokens
│  ├─ instagram/page.tsx    Placeholder
│  ├─ linkedin/page.tsx     Placeholder
│  ├─ leads/page.tsx        Placeholder
│  ├─ emails/page.tsx       Placeholder
│  ├─ chat/page.tsx         Command Chat placeholder
│  ├─ settings/page.tsx     Placeholder
│  └─ api/
│     ├─ stats/route.ts     Live counts for the topbar
│     └─ init/route.ts      Init schema + start scheduler
├─ components/
│  ├─ Sidebar.tsx           Nav links to all modules
│  ├─ Topbar.tsx            Stats strip (fetches /api/stats)
│  └─ ChatWidget.tsx        Floating chat placeholder
├─ lib/
│  ├─ db.ts                 SQLite setup, schema & query helpers
│  ├─ gemini.ts             Google Gen AI (Gemini) wrapper
│  ├─ mailer.ts             Nodemailer (Gmail) setup
│  └─ scheduler.ts          node-cron jobs
├─ scripts/
│  └─ init-db.js            Standalone DB initialiser
├─ output/
│  ├─ carousels/            Generated Instagram carousels
│  └─ linkedin/             Generated LinkedIn assets
├─ data/                    SQLite database lives here (leads.db)
├─ .env.local.example       Required env var keys (no values)
└─ package.json
```

## Database schema

**leads** — `id`, `name`, `location`, `website`, `email`, `agency_type`,
`region`, `status` (`new`/`drafted`/`sent`/`replied`), `email_subject`,
`email_body`, `created_at`, `sent_at`

**posts** — `id`, `platform` (`instagram`/`linkedin`), `topic`, `audience`,
`content_json`, `caption`, `hashtags`, `status`
(`draft`/`approved`/`published`), `scheduled_for`, `created_at`, `published_at`

**settings** — `key`, `value` (preferences such as tone and brand colours)

## Theme

| Token          | Value      |
| -------------- | ---------- |
| Background     | `#0f0f0f`  |
| Surface cards  | `#1a1a1a`  |
| Accent         | `#c8f542`  |
| Text primary   | `#ffffff`  |
| Text secondary | `#888888`  |
| Border         | `#2a2a2a`  |
| Font           | Inter      |

## Notes

- The scheduler can be started by POSTing to `/api/init` (it also runs schema
  setup). Wire real Meta/LinkedIn publishing into `lib/scheduler.ts`.
- Module pages (Instagram, LinkedIn, Leads, Emails, Command Chat, Settings) are
  scaffolded as placeholders, ready to build out.
