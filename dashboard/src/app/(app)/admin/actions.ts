'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  clearPasscodeFailures,
  isAdminEmail,
  isPasscodeLockedOut,
  passcodeToken,
  recordPasscodeFailure,
  requireAdmin,
  verifyPasscode,
} from '@/lib/admin';
import {
  setAdminNotes,
  setUserAdmin,
  setWaitlistStatus,
  snapshotUser,
  writeAdminAudit,
} from '@/lib/admin-ops';
import type { WaitlistStatus } from '@/lib/admin-types';
import { currentUserEmail } from '@/lib/auth';
import type { Plan } from '@/lib/billing/types';
import { getStore } from '@/lib/store';

function adminRedirect(params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/admin?${q}`);
}

function userRedirect(email: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/admin/users/${encodeURIComponent(email)}?${q}`);
}

/** Unlock the admin console with the passcode (second factor). */
export async function submitPasscode(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!(await isAdminEmail(email)) || !email) redirect('/dashboard');

  if (isPasscodeLockedOut(email)) {
    redirect('/admin?err=locked');
  }

  const input = String(formData.get('passcode') ?? '');
  if (!verifyPasscode(input)) {
    const { locked } = recordPasscodeFailure(email);
    redirect(locked ? '/admin?err=locked' : '/admin?bad=1');
  }

  clearPasscodeFailures(email);
  const c = await cookies();
  c.set(ADMIN_COOKIE, passcodeToken(email), adminCookieOptions());
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
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const plan = String(formData.get('plan') ?? 'solo') as Plan;
  const days = Math.max(1, Math.min(3650, Number(formData.get('days') ?? 31)));
  const reason = String(formData.get('reason') ?? '').trim();

  if (!/^\S+@\S+\.\S+$/.test(email) || (plan !== 'solo' && plan !== 'team')) {
    adminRedirect({ err: 'invalid_grant' });
  }
  if (!reason) adminRedirect({ err: 'reason_required' });

  const store = getStore();
  const beforeUser = await store.ensureUser(email);
  const before = snapshotUser(beforeUser);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + days);
  await store.setSubscription(email, plan, 'active', until.toISOString(), 'comp');
  const afterUser = await store.ensureUser(email);

  await writeAdminAudit({
    actorEmail: actor,
    action: 'grant',
    targetEmail: email,
    reason,
    before,
    after: { ...snapshotUser(afterUser), days },
  });

  revalidatePath('/admin');
  adminRedirect({ ok: 'granted', email });
}

/** Revoke access immediately (sets expired, clears the paid window). */
export async function revokePlan(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) adminRedirect({ err: 'invalid_email' });
  if (!reason) adminRedirect({ err: 'reason_required' });

  const store = getStore();
  const user = await store.ensureUser(email);
  const before = snapshotUser(user);
  await store.setSubscription(email, user.plan, 'expired', null, 'none');
  const after = await store.ensureUser(email);

  await writeAdminAudit({
    actorEmail: actor,
    action: 'revoke',
    targetEmail: email,
    reason,
    before,
    after: snapshotUser(after),
  });

  revalidatePath('/admin');
  adminRedirect({ ok: 'revoked', email });
}

export async function promoteAdmin(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const result = await setUserAdmin(actor, email, true, reason);
  if (result === 'not_found') adminRedirect({ err: 'not_found' });

  revalidatePath('/admin');
  revalidatePath(`/admin/users/${encodeURIComponent(email)}`);
  adminRedirect({ ok: 'promoted', email });
}

export async function demoteAdmin(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const result = await setUserAdmin(actor, email, false, reason);
  if (result === 'self') adminRedirect({ err: 'cannot_demote_self' });
  if (result === 'last_admin') adminRedirect({ err: 'last_admin' });
  if (result === 'not_found') adminRedirect({ err: 'not_found' });

  revalidatePath('/admin');
  revalidatePath(`/admin/users/${encodeURIComponent(email)}`);
  adminRedirect({ ok: 'demoted', email });
}

export async function saveAdminNotes(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const notes = String(formData.get('notes') ?? '');
  if (!email) adminRedirect({ err: 'invalid_email' });

  await setAdminNotes(actor, email, notes);
  revalidatePath(`/admin/users/${encodeURIComponent(email)}`);
  userRedirect(email, { ok: 'notes_saved' });
}

export async function updateWaitlistStatus(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const tool = String(formData.get('tool') ?? '').trim();
  const status = String(formData.get('status') ?? 'new') as WaitlistStatus;
  if (!email || !tool || !['new', 'contacted', 'converted'].includes(status)) {
    adminRedirect({ err: 'invalid_waitlist' });
  }

  await setWaitlistStatus(actor, email, tool, status);
  revalidatePath('/admin');
  adminRedirect({ ok: 'waitlist_updated' });
}

export async function markPastDue(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!email || !reason) adminRedirect({ err: 'reason_required' });

  const store = getStore();
  const user = await store.ensureUser(email);
  const before = snapshotUser(user);
  await store.setSubscription(email, user.plan, 'past_due', user.paidUntil, user.accessSource);
  const after = await store.ensureUser(email);

  await writeAdminAudit({
    actorEmail: actor,
    action: 'mark_past_due',
    targetEmail: email,
    reason,
    before,
    after: snapshotUser(after),
  });

  revalidatePath(`/admin/users/${encodeURIComponent(email)}`);
  userRedirect(email, { ok: 'past_due' });
}

export async function extendAccess(formData: FormData): Promise<void> {
  const actor = await requireAdmin();
  if (!actor) adminRedirect({ err: 'unauthorized' });

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const days = Math.max(1, Math.min(3650, Number(formData.get('days') ?? 31)));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!email || !reason) adminRedirect({ err: 'reason_required' });

  const store = getStore();
  const user = await store.ensureUser(email);
  const before = snapshotUser(user);
  const base = user.paidUntil && new Date(user.paidUntil) > new Date()
    ? new Date(user.paidUntil)
    : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  const source = user.accessSource === 'payment' ? 'payment' : 'comp';
  await store.setSubscription(email, user.plan, 'active', base.toISOString(), source);
  const after = await store.ensureUser(email);

  await writeAdminAudit({
    actorEmail: actor,
    action: 'extend',
    targetEmail: email,
    reason,
    before,
    after: { ...snapshotUser(after), days },
  });

  revalidatePath(`/admin/users/${encodeURIComponent(email)}`);
  userRedirect(email, { ok: 'extended' });
}
