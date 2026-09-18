import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/linkedin/auth -> redirects to LinkedIn's OAuth consent screen.
// One-time helper to obtain a personal access token for posting.
export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    "http://localhost:3000/api/linkedin/callback";

  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID is not set in .env.local" },
      { status: 500 }
    );
  }

  const scope = "openid profile w_member_social";
  const state = Math.random().toString(36).slice(2);

  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
