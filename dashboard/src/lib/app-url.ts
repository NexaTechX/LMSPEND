/** Central base-URL resolution — auth callbacks, emails and share links all embed it. */

const PRODUCTION_APP_URL = 'https://lmspend.vercel.app';

/**
 * Base URL of this deployment, without a trailing slash.
 *
 * `NEXT_PUBLIC_APP_URL` set to an empty string must not count as configured:
 * `??` would accept it and every generated link would fall back to localhost.
 */
export function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const cleaned = explicit.replace(/\/+$/, '');
    // Typo host (verce.app) returns empty 204s — blank X/IG/WhatsApp previews.
    try {
      const host = new URL(cleaned).hostname.toLowerCase();
      if (host === 'lmspend.verce.app' || host.endsWith('.verce.app')) {
        return PRODUCTION_APP_URL;
      }
    } catch {
      /* fall through */
    }
    return cleaned;
  }

  // Injected by Vercel on every deployment; the project's production domain.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`;

  if (process.env.VERCEL === '1') return PRODUCTION_APP_URL;

  return 'http://localhost:3000';
}

/** Where Supabase sends users back after a confirmation or password-reset email. */
export function authCallbackUrl(): string {
  return `${resolveAppUrl()}/auth/callback`;
}
