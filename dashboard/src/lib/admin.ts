import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { currentUserEmail } from './auth';
import { supabaseConfigured } from './supabase/config';
import { getStore } from './store';

/**
 * Super-admin gate — two factors:
 *  1. users.is_admin = true in Postgres (set via SQL / owner tooling)
 *  2. IF LMSPEND_ADMIN_PASSCODE is set, a matching passcode cookie is present
 *
 * The passcode is a second lock on the owner console: even if someone reaches
 * the admin inbox, they still need the passcode. The cookie stores an HMAC of a
 * fixed string keyed by the passcode — never the passcode itself.
 */

export const ADMIN_COOKIE = 'lmspend_admin';

export async function isAdminEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
  // Dev convenience: no Supabase → memory store treats everyone as admin.
  if (!supabaseConfigured()) return true;
  const user = await getStore().ensureUser(email);
  return user.isAdmin;
}

function passcode(): string | null {
  const p = process.env.LMSPEND_ADMIN_PASSCODE;
  return p && p.length > 0 ? p : null;
}

export function passcodeRequired(): boolean {
  return passcode() !== null;
}

/** The value we store in the cookie: HMAC(fixed-string, passcode). */
export function passcodeToken(): string {
  const p = passcode();
  if (!p) return '';
  return createHmac('sha256', p).update('lmspend-admin-gate').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** True if the user typed the correct passcode. */
export function verifyPasscode(input: string): boolean {
  const p = passcode();
  return p !== null && safeEqual(input, p);
}

/** True if the current request carries a valid passcode cookie (or none needed). */
export async function passcodeUnlocked(): Promise<boolean> {
  if (!passcodeRequired()) return true;
  const c = await cookies();
  const val = c.get(ADMIN_COOKIE)?.value;
  return val ? safeEqual(val, passcodeToken()) : false;
}

/** Full server-side guard for admin actions. Returns email or null. */
export async function requireAdmin(): Promise<string | null> {
  const email = await currentUserEmail();
  if (!(await isAdminEmail(email))) return null;
  if (!(await passcodeUnlocked())) return null;
  return email;
}
