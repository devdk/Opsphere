import { NextResponse } from "next/server";
import { setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/linkedin/callback -> exchanges the OAuth code for an access token,
// fetches the member's person URN, and shows everything ready to paste into
// .env.local. One-time setup helper.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return html(`<h2>LinkedIn returned an error</h2><p>${error}: ${errorDesc ?? ""}</p>`);
  }
  if (!code) {
    return html(`<h2>Missing code</h2><p>Start at <a href="/api/linkedin/auth">/api/linkedin/auth</a>.</p>`);
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    "http://localhost:3000/api/linkedin/callback";

  if (!clientId || !clientSecret) {
    return html(`<h2>Config missing</h2><p>Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env.local.</p>`);
  }

  // 1) Exchange the authorization code for an access token.
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return html(
      `<h2>Token exchange failed</h2><pre>${escapeHtml(
        JSON.stringify(tokenJson, null, 2)
      )}</pre>`
    );
  }

  const accessToken = tokenJson.access_token;

  // 2) Fetch the member's URN via OpenID userinfo.
  let personUrn = "";
  try {
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const me = (await meRes.json()) as { sub?: string };
    if (me.sub) personUrn = `urn:li:person:${me.sub}`;
  } catch {
    // userinfo is best-effort; token still valid for posting.
  }

  const days = tokenJson.expires_in
    ? Math.round(tokenJson.expires_in / 86400)
    : undefined;

  // Record issue/expiry so the daily token-expiry-check can warn in time.
  try {
    const now = new Date();
    setSetting("linkedin_token_issued_at", now.toISOString());
    if (tokenJson.expires_in) {
      setSetting(
        "linkedin_token_expires_at",
        new Date(now.getTime() + tokenJson.expires_in * 1000).toISOString()
      );
    }
  } catch {
    /* settings write is best-effort */
  }

  const envBlock =
    `LINKEDIN_ACCESS_TOKEN=${accessToken}\n` +
    (personUrn ? `LINKEDIN_PERSON_URN=${personUrn}\n` : "");

  return html(`
    <h2>✅ LinkedIn token generated</h2>
    <p>Copy these lines into <code>.env.local</code>, then restart <code>npm run dev</code>:</p>
    <textarea readonly style="width:100%;height:120px;font-family:monospace;font-size:13px">${escapeHtml(
      envBlock
    )}</textarea>
    <p style="color:#666">Access token expires in ${
      days ? days + " days" : "~60 days"
    }.${
      tokenJson.refresh_token ? " A refresh token was also issued." : ""
    }</p>
    <p>Person URN: <code>${personUrn || "could not fetch — check the 'profile' scope"}</code></p>
  `);
}

function html(body: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>LinkedIn token</title>
     <style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111}
     code{background:#f2f2f2;padding:2px 5px;border-radius:4px}</style></head>
     <body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
