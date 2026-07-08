'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, isAdminEmail, passcodeToken, requireAdmin, verifyPasscode } from '@/lib/admin';
import { currentUserEmail } from '@/lib/auth';
import type { Plan } from '@/lib/billing/types';
import { getStore } from '@/lib/store';

/** Unlock the admin console with the passcode (second factor). */
export async function submitPasscode(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!isAdminEmail(email)) redirect('/dashboard');

  const input = String(formData.get('passcode') ?? '');
  if (!verifyPasscode(input)) redirect('/admin?bad=1');

  const c = await cookies();
  c.set(ADMIN_COOKIE, passcodeToken(), {
    httpOnly: true, sameSite: 'lax', path: '/admin', maxAge: 60 * 60 * 8, // 8h
  });
  redirect('/admin');
}

/** Lock the console again (clear the passcode cookie). */
export async function lockAdmin(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
  redirect('/admin');
}

/** Comp/grant a plan (e.g. fix a failed webhook, gift a friend). */
export async function grantPlan(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const plan = String(formData.get('plan') ?? 'solo') as Plan;
  const days = Math.max(1, Math.min(3650, Number(formData.get('days') ?? 31)));
  if (!/^\S+@\S+\.\S+$/.test(email) || (plan !== 'solo' && plan !== 'team')) return;

  const store = getStore();
  await store.ensureUser(email);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + days);
  await store.setSubscription(email, plan, 'active', until.toISOString());
  revalidatePath('/admin');
}

/** Revoke access immediately (sets expired, clears the paid window). */
export async function revokePlan(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return;

  const store = getStore();
  const user = await store.ensureUser(email);
  await store.setSubscription(email, user.plan, 'expired', null);
  revalidatePath('/admin');
}
