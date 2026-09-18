import { getSetting, setSetting } from "./db";

const GRAPH = "https://graph.facebook.com";

function base(): string {
  return `${GRAPH}/${process.env.META_GRAPH_VERSION || "v21.0"}`;
}

/**
 * Token resolution: a refreshed token stored in settings (written by the
 * auto-refresh cron) wins over the one pasted into .env.local.
 */
export function getMetaToken(): string | undefined {
  return getSetting("meta_access_token") || process.env.META_ACCESS_TOKEN || undefined;
}

export function getMetaCreds(): { userId: string; token: string } {
  const userId = process.env.META_USER_ID;
  const token = getMetaToken();
  if (!userId || !token) {
    throw new Error(
      "META_USER_ID / META_ACCESS_TOKEN are not set in .env.local (see PHASE1-SETUP.md)."
    );
  }
  return { userId, token };
}

interface GraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

/** Minimal Graph API caller. GET params go in the query string, POST in the body. */
async function graph<T>(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const { token } = getMetaCreds();
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res =
    method === "GET"
      ? await fetch(`${base()}/${path}?${qs}`)
      : await fetch(`${base()}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: qs.toString(),
        });

  const raw = await res.text();
  let json: { error?: GraphError } & T;
  try {
    json = raw ? JSON.parse(raw) : ({} as never);
  } catch {
    throw new Error(
      `Graph API ${path} returned non-JSON (${res.status}): ${raw.slice(0, 200)}`
    );
  }
  if (!res.ok || json.error) {
    const e = json.error || {};
    throw new Error(
      `Graph API ${path} failed (${res.status}): ${e.message || raw.slice(0, 200)}` +
        (e.code ? ` [code ${e.code}${e.error_subcode ? `/${e.error_subcode}` : ""}]` : "")
    );
  }
  return json;
}

/** Read-only: confirm the token + IG user id are valid. */
export async function verifyMeta(): Promise<{ id: string; username?: string }> {
  const { userId } = getMetaCreds();
  return graph<{ id: string; username?: string }>(userId, {
    fields: "id,username",
  });
}

/**
 * IG processes media containers asynchronously — poll status_code until
 * FINISHED before publishing, or media_publish fails with a cryptic error.
 */
async function waitForContainer(creationId: string, label: string): Promise<void> {
  const TIMEOUT_MS = 120_000;
  const started = Date.now();
  while (Date.now() - started < TIMEOUT_MS) {
    const s = await graph<{ status_code?: string; status?: string }>(creationId, {
      fields: "status_code,status",
    });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error(`${label} container ${s.status_code}: ${s.status || "no detail"}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`${label} container not ready after ${TIMEOUT_MS / 1000}s`);
}

/** Publish a single image post. imageUrl must be publicly reachable. */
export async function publishSingleImage(
  imageUrl: string,
  caption: string
): Promise<string> {
  const { userId } = getMetaCreds();
  const container = await graph<{ id: string }>(
    `${userId}/media`,
    { image_url: imageUrl, caption },
    "POST"
  );
  await waitForContainer(container.id, "image");
  const pub = await graph<{ id: string }>(
    `${userId}/media_publish`,
    { creation_id: container.id },
    "POST"
  );
  return pub.id;
}

/**
 * Publish a carousel (2-10 images). Flow: one item container per image ->
 * wait for all -> CAROUSEL container -> wait -> media_publish.
 * All imageUrls must be publicly reachable.
 */
export async function publishCarousel(
  imageUrls: string[],
  caption: string
): Promise<string> {
  if (imageUrls.length < 2 || imageUrls.length > 10) {
    throw new Error(`Instagram carousels need 2-10 images (got ${imageUrls.length}).`);
  }
  const { userId } = getMetaCreds();

  const children: string[] = [];
  for (const url of imageUrls) {
    const item = await graph<{ id: string }>(
      `${userId}/media`,
      { image_url: url, is_carousel_item: "true" },
      "POST"
    );
    children.push(item.id);
  }
  for (let i = 0; i < children.length; i++) {
    await waitForContainer(children[i], `slide ${i + 1}`);
  }

  const carousel = await graph<{ id: string }>(
    `${userId}/media`,
    { media_type: "CAROUSEL", children: children.join(","), caption },
    "POST"
  );
  await waitForContainer(carousel.id, "carousel");

  const pub = await graph<{ id: string }>(
    `${userId}/media_publish`,
    { creation_id: carousel.id },
    "POST"
  );
  return pub.id;
}

// ---- Token lifecycle -------------------------------------------------------

/**
 * Exchange the current long-lived token for a fresh one (~60 days).
 * Requires META_APP_ID + META_APP_SECRET. The new token is stored in settings
 * (meta_access_token) and used from then on.
 */
export async function refreshMetaToken(): Promise<{ expiresInDays?: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("META_APP_ID / META_APP_SECRET are not set — cannot auto-refresh.");
  }
  const current = getMetaToken();
  if (!current) throw new Error("no Meta token to refresh");

  const qs = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: current,
  });
  const res = await fetch(`${base()}/oauth/access_token?${qs}`);
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: GraphError;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `token refresh failed (${res.status}): ${json.error?.message || "no access_token"}`
    );
  }
  setSetting("meta_access_token", json.access_token);
  setSetting("meta_token_issued_at", new Date().toISOString());
  return {
    expiresInDays: json.expires_in
      ? Math.round(json.expires_in / 86400)
      : undefined,
  };
}

/**
 * Real token expiry via /debug_token (needs app id+secret). Returns null when
 * app credentials are missing or the token never expires.
 */
export async function getMetaTokenExpiry(): Promise<Date | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const token = getMetaToken();
  if (!appId || !appSecret || !token) return null;

  const qs = new URLSearchParams({
    input_token: token,
    access_token: `${appId}|${appSecret}`,
  });
  const res = await fetch(`${base()}/debug_token?${qs}`);
  const json = (await res.json()) as {
    data?: { expires_at?: number };
    error?: GraphError;
  };
  if (!res.ok || !json.data) return null;
  const ts = json.data.expires_at;
  return ts && ts > 0 ? new Date(ts * 1000) : null;
}
