import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { currentUserEmail } from './auth';
import { supabaseConfigured } from './supabase/config';
import { getStore } from './store';

/**
 * Super-admin gate — two factors:
 *  1. users.is_admin = true in Postgres
 *  2. IF LMSPEND_ADMIN_PASSCODE is set, a matching passcode cookie is present
 *
 * Unlock cookies are bound to the admin email (HMAC includes email). Failed
 * unlocks are rate-limited in-memory; after MAX_FAILS the email is locked out
 * for LOCKOUT_MS.
 */

export const ADMIN_COOKIE = 'lmspend_admin';

const MAX_FAILS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

const g = globalThis as unknown as {
  __lmspendAdminFails?: Map<string, { count: number; firstAt: number; lockedUntil: number }>;
};
const fails: Map<string, { count: number; firstAt: number; lockedUntil: number }> =
  g.__lmspendAdminFails ?? new Map();
g.__lmspendAdminFails = fails;

export async function isAdminEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
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

/** Cookie value: HMAC(passcode, email + gate) — session-bound to the admin email. */
export function passcodeToken(email: string): string {
  const p = passcode();
  if (!p) return '';
  return createHmac('sha256', p).update(`${email.toLowerCase()}:lmspend-admin-gate`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function isPasscodeLockedOut(email: string): boolean {
  const row = fails.get(email.toLowerCase());
  if (!row) return false;
  if (row.lockedUntil > Date.now()) return true;
  if (Date.now() - row.firstAt > FAIL_WINDOW_MS) {
    fails.delete(email.toLowerCase());
    return false;
  }
  return false;
}

export function recordPasscodeFailure(email: string): { locked: boolean; remaining: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  let row = fails.get(key);
  if (!row || now - row.firstAt > FAIL_WINDOW_MS) {
    row = { count: 0, firstAt: now, lockedUntil: 0 };
  }
  row.count += 1;
  if (row.count >= MAX_FAILS) {
    row.lockedUntil = now + LOCKOUT_MS;
  }
  fails.set(key, row);
  return {
    locked: row.lockedUntil > now,
    remaining: Math.max(0, MAX_FAILS - row.count),
  };
}

export function clearPasscodeFailures(email: string): void {
  fails.delete(email.toLowerCase());
}

export function verifyPasscode(input: string): boolean {
  const p = passcode();
  if (!p) return false;
  try {
    return safeEqual(input, p);
  } catch {
    return false;
  }
}

export async function passcodeUnlocked(): Promise<boolean> {
  if (!passcodeRequired()) return true;
  const email = await currentUserEmail();
  if (!email) return false;
  const c = await cookies();
  const val = c.get(ADMIN_COOKIE)?.value;
  return val ? safeEqual(val, passcodeToken(email)) : false;
}

export function adminCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/admin',
    maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  };
}

/** Full server-side guard for admin actions. Returns email or null. */
export async function requireAdmin(): Promise<string | null> {
  const email = await currentUserEmail();
  if (!(await isAdminEmail(email))) return null;
  if (!(await passcodeUnlocked())) return null;
  return email;
}
