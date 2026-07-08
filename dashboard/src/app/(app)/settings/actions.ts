'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { currentUserEmail } from '@/lib/auth';
import { can } from '@/lib/plan';
import { getStore } from '@/lib/store';

const NEW_KEY_COOKIE = 'lmspend_new_key';

export async function createApiKey(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const label = String(formData.get('label') ?? '').trim().slice(0, 60) || 'default';
  const raw = await getStore().createApiKey(email, label);

  // Shown once on the next render, then gone.
  const cookieStore = await cookies();
  cookieStore.set(NEW_KEY_COOKIE, raw, { maxAge: 60, httpOnly: true, sameSite: 'lax', path: '/settings' });
  revalidatePath('/settings');
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const prefix = String(formData.get('prefix') ?? '');
  if (prefix) await getStore().revokeApiKey(email, prefix);
  revalidatePath('/settings');
}

export async function readNewKeyOnce(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(NEW_KEY_COOKIE)?.value ?? null;
}

export async function saveBudget(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const raw = String(formData.get('limit') ?? '').trim();
  const limit = raw === '' ? null : Number(raw);
  if (limit !== null && (!Number.isFinite(limit) || limit < 0)) return;

  await getStore().setBudget(email, limit);
  revalidatePath('/settings');
}

export async function saveSlackWebhook(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const raw = String(formData.get('webhook') ?? '').trim();
  if (raw !== '' && !/^https:\/\/hooks\.slack\.com\//.test(raw)) return;

  await getStore().setSlackWebhook(email, raw === '' ? null : raw);
  revalidatePath('/settings');
}

export async function toggleEmailReports(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  await getStore().setEmailReports(email, formData.get('on') === 'true');
  revalidatePath('/settings');
}

export async function toggleRealtime(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const store = getStore();
  const user = await store.ensureUser(email);
  if (!can(user).realtime) return; // paid feature only

  await store.setRealtimeEnabled(email, formData.get('on') === 'true');
  revalidatePath('/settings');
  revalidatePath('/dashboard');
}
