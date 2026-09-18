import { getSetting } from "./db";
import { notify } from "./notify";
import { getMetaToken, getMetaTokenExpiry, refreshMetaToken } from "./meta";

/**
 * Daily token-lifecycle check (run by the cron scheduler).
 *
 * LinkedIn: tokens last ~60 days and cannot be refreshed without re-auth.
 *   The OAuth callback stores linkedin_token_expires_at; warn 10 days out.
 * Meta: if META_APP_ID/SECRET are set, auto-refresh when <15 days remain
 *   (and read the true expiry from /debug_token). Otherwise fall back to the
 *   meta_token_issued_at heuristic and warn like LinkedIn.
 */

const WARN_DAYS = 10;
const REFRESH_DAYS = 15;
const ASSUMED_LIFETIME_DAYS = 60;

function daysUntil(d: Date): number {
  return Math.floor((d.getTime() - Date.now()) / 86_400_000);
}

function heuristicExpiry(issuedAtIso: string | null): Date | null {
  if (!issuedAtIso) return null;
  const t = new Date(issuedAtIso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + ASSUMED_LIFETIME_DAYS * 86_400_000);
}

export async function checkTokenExpiry(): Promise<void> {
  // ---- LinkedIn -----------------------------------------------------------
  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    const expiry =
      (getSetting("linkedin_token_expires_at") &&
        new Date(getSetting("linkedin_token_expires_at") as string)) ||
      heuristicExpiry(getSetting("linkedin_token_issued_at"));
    if (expiry) {
      const left = daysUntil(expiry);
      if (left <= 0) {
        await notify({
          level: "error",
          title: "LinkedIn token has EXPIRED",
          body: "Publishing to LinkedIn will fail. Re-authorize now.",
          link: "/api/linkedin/auth",
        });
      } else if (left <= WARN_DAYS) {
        await notify({
          level: "warning",
          title: `LinkedIn token expires in ${left} day${left === 1 ? "" : "s"}`,
          body: "Visit /api/linkedin/auth to generate a fresh token, then update .env.local and restart.",
          link: "/api/linkedin/auth",
          email: true,
        });
      }
    }
  }

  // ---- Meta / Instagram ---------------------------------------------------
  if (!getMetaToken()) return;

  const realExpiry = await getMetaTokenExpiry().catch(() => null);
  const expiry =
    realExpiry || heuristicExpiry(getSetting("meta_token_issued_at"));
  if (!expiry) return;

  const left = daysUntil(expiry);
  const canAutoRefresh = Boolean(
    process.env.META_APP_ID && process.env.META_APP_SECRET
  );

  if (canAutoRefresh && left <= REFRESH_DAYS) {
    try {
      const r = await refreshMetaToken();
      await notify({
        level: "success",
        title: "Meta token auto-refreshed",
        body: `New long-lived token stored${r.expiresInDays ? ` (~${r.expiresInDays} days)` : ""}. No action needed.`,
        link: "/settings",
      });
      return;
    } catch (e) {
      await notify({
        level: "error",
        title: "Meta token auto-refresh FAILED",
        body: (e as Error).message,
        link: "/settings",
      });
      return;
    }
  }

  if (left <= 0) {
    await notify({
      level: "error",
      title: "Meta token has EXPIRED",
      body: "Instagram publishing will fail. Generate a new long-lived token (see PHASE1-SETUP.md).",
      link: "/settings",
    });
  } else if (left <= WARN_DAYS) {
    await notify({
      level: "warning",
      title: `Meta token expires in ${left} day${left === 1 ? "" : "s"}`,
      body: "Generate a new long-lived token, or set META_APP_ID/META_APP_SECRET to enable auto-refresh.",
      link: "/settings",
      email: true,
    });
  }
}
