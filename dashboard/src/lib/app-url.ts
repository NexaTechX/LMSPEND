/** Central base-URL resolution — auth callbacks, emails and share links all embed it. */

/**
 * Base URL of this deployment, without a trailing slash.
 *
 * `NEXT_PUBLIC_APP_URL` set to an empty string must not count as configured:
 * `??` would accept it and every generated link would fall back to localhost.
 */
export function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // Injected by Vercel on every deployment; the project's production domain.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

/** Where Supabase sends users back after a magic link or OAuth round-trip. */
export function authCallbackUrl(): string {
  return `${resolveAppUrl()}/auth/callback`;
}
