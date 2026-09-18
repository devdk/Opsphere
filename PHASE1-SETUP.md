# Phase 1 — Instagram Publishing: Setup

Code is done. Two external accounts need one-time setup: **Meta** and **Cloudinary**.

## 1. Cloudinary (5 min, free)

Instagram's Graph API only accepts **public image URLs**, and the app runs on
localhost — so rendered slides are pushed to Cloudinary at publish time.

1. Create a free account at cloudinary.com.
2. Dashboard → note your **Cloud name**.
3. Settings → Upload → **Add upload preset** → Signing Mode: **Unsigned** → save
   and note the preset name.
4. Fill in `.env.local`:
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_UPLOAD_PRESET=your-preset-name
   ```
5. Settings page → "Cloudinary (IG image hosting)" → **Test** (does a real 1×1 upload).

## 2. Meta / Instagram (30–60 min, one time)

1. **Instagram account → Professional (Business)** (Instagram app → Settings →
   Account type). Link it to a **Facebook Page** (create one if needed).
2. **Meta app**: developers.facebook.com → My Apps → Create App (type:
   Business). Add the **Instagram Graph API** and **Facebook Login** products.
3. **Token**: easiest path is the Graph API Explorer
   (developers.facebook.com/tools/explorer):
   - Select your app, add permissions: `instagram_basic`,
     `instagram_content_publish`, `pages_show_list`, `business_management`.
   - Generate Access Token, log in, approve.
   - Exchange for a **long-lived token (60 days)**:
     ```
     GET https://graph.facebook.com/v21.0/oauth/access_token
       ?grant_type=fb_exchange_token
       &client_id={app-id}&client_secret={app-secret}
       &fb_exchange_token={short-lived-token}
     ```
4. **IG user id**:
   ```
   GET /me/accounts                       -> your Page id
   GET /{page-id}?fields=instagram_business_account  -> IG user id
   ```
5. Fill in `.env.local`:
   ```
   META_USER_ID=1784...            # the instagram_business_account id
   META_ACCESS_TOKEN=EAAG...       # the long-lived token
   ```
6. Restart the dev server, Settings → "Meta / Instagram" → **Test** — should
   show your @username.

> Your own account works in Development Mode as long as you're an
> admin/tester on the app — no App Review needed for personal use.
> Long-lived tokens expire after ~60 days (auto-refresh lands in Phase 2).

## 3. Publish

Instagram page → any carousel → **Publish to Instagram**. The button renders
the slides exactly as previewed, saves them, uploads to Cloudinary, then runs
the Graph flow (item containers → carousel container → publish). Expect
30–90s; the card flips to "Published ✓".

Rate limit: Instagram allows max **25 API-published posts per 24h** — far more
than needed.

## What changed (files)

| File | Change |
|---|---|
| `lib/meta.ts` | **new** — Graph API wrapper (verify, single image, carousel, container polling) |
| `lib/imagehost.ts` | **new** — Cloudinary unsigned upload |
| `app/api/posts/[id]/slides/route.ts` | **new** — saves client-rendered slide PNGs |
| `app/api/posts/[id]/publish/route.ts` | Instagram branch added (was LinkedIn-only) |
| `app/api/settings/test/route.ts` | `meta` + `cloudinary` live tests |
| `app/api/settings/route.ts` | cloudinary env flag |
| `app/settings/page.tsx` | Meta + Cloudinary test buttons |
| `components/CarouselStudio.tsx` | "Publish to Instagram" button + status |
| `.env.local.example` | Cloudinary/Hunter keys, fixed stray line |

No new npm packages needed.
