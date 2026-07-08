'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { currentUserEmail } from '@/lib/auth';
import { can } from '@/lib/plan';
import { getStore } from '@/lib/store';

export async function createTeam(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const store = getStore();
  const user = await store.ensureUser(email);
  if (!can(user).teamFeatures) return;
  if (await store.getTeam(email)) return; // one team per user

  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'My team';
  await store.createTeam(email, name);
  revalidatePath('/team');
}

export async function createInvite(): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const store = getStore();
  const team = await store.getTeam(email);
  if (!team || team.role !== 'owner') return;

  const token = await store.createTeamInvite(team.id);
  const cookieStore = await cookies();
  cookieStore.set('lmspend_invite_token', token, {
    maxAge: 3600, httpOnly: true, sameSite: 'lax', path: '/team',
  });
  revalidatePath('/team');
}

export async function removeMember(formData: FormData): Promise<void> {
  const email = await currentUserEmail();
  if (!email) return;

  const store = getStore();
  const team = await store.getTeam(email);
  if (!team || team.role !== 'owner') return;

  const target = String(formData.get('email') ?? '');
  if (target && target !== email) await store.removeTeamMember(team.id, target);
  revalidatePath('/team');
}
