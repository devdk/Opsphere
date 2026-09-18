# DK's To-Do — manual jobs on your side

Things only you can do (accounts, tokens, approvals). Claude maintains this
file; tick items off as you go. Code-side work is tracked in
`command-centre-roadmap.md`.

## ⚠️ Do first (security)

- [ ] **Rotate the Gemini API key** — the old one shipped inside command-centre.zip
- [ ] **Rotate LinkedIn client secret + access token** (same reason), then re-run
      `/api/linkedin/auth`
- [ ] Never zip the project with `.env.local` inside (exclude it, or move
      secrets out before sharing)

## Phase 1 — Instagram publishing (code ✅ shipped, needs your accounts)

- [ ] Cloudinary: free account → note **cloud name** → create **unsigned upload
      preset** → fill `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_UPLOAD_PRESET`
- [ ] Instagram account → **Professional (Business)**, linked to a Facebook Page
- [ ] Meta developer app (type Business) with Instagram Graph API product
- [ ] Generate token in Graph API Explorer with `instagram_basic`,
      `instagram_content_publish`, `pages_show_list`, `business_management`
- [ ] Exchange for **long-lived token** → fill `META_ACCESS_TOKEN`
- [ ] Get IG business user id (`/me/accounts` → page → `instagram_business_account`)
      → fill `META_USER_ID`
- [ ] Settings page → Test **Meta** and **Cloudinary** → both green
- [ ] Publish one real carousel end-to-end

## Phase 2 — Reliability (code ✅ shipped, small setup)

- [ ] Fill `META_APP_ID` + `META_APP_SECRET` in `.env.local` (app dashboard →
      Settings → Basic) — enables **token auto-refresh** + exact expiry tracking
- [ ] Re-run `/api/linkedin/auth` once so the app records your LinkedIn token's
      expiry date (warnings start working from then)
- [ ] Keep `npm run scheduler` running alongside `npm run dev` (or POST
      `/api/init` after server start) so scheduled publishing + daily token
      checks actually fire

## Phase 3 — Leads (code not started)

- [ ] Hunter.io free account → fill `HUNTER_API_KEY`
- [ ] Decide target directories/sources for scraping (e.g. Clutch, Yell,
      Google Maps) and priority regions (UK cities / Indian tier-1)

## Phase 4 — Emails / outreach (code not started)

- [ ] Gmail: enable 2FA → create an **App Password** → fill `GMAIL_USER` +
      `GMAIL_APP_PASSWORD` + `PREVIEW_EMAIL`
- [ ] Decide sender identity (personal Gmail vs a dedicated outreach address —
      dedicated recommended so your main address never risks spam flags)
- [ ] Confirm the compliance footer text (business name + address + opt-out
      line — required for UK PECR/GDPR cold email)
- [ ] Agree daily send cap (recommended: start 20/day)

## Recurring (calendar reminders)

- [ ] ~Every 55 days: refresh **LinkedIn** token via `/api/linkedin/auth`
      (the app warns you 10 days out — but a calendar backup doesn't hurt)
- [ ] Meta token: automatic once `META_APP_ID/SECRET` are set; otherwise same
      55-day manual routine
