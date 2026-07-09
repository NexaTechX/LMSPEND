'use server';

import { redirect } from 'next/navigation';
import { authCallbackUrl } from '@/lib/app-url';
import { safeNextPath } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;

/** Back to /login, keeping the destination so a failed attempt doesn't lose it. */
function loginUrl(query: string, next: string | null): string {
  const params = new URLSearchParams(query);
  if (next) params.set('next', next);
  return `/login?${params}`;
}

/** Supabase sends the confirmation email here; `next` survives the round-trip. */
function callbackUrl(next: string | null): string {
  return next ? `${authCallbackUrl()}?next=${encodeURIComponent(next)}` : authCallbackUrl();
}

export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? ''));
  if (!EMAIL_RE.test(email)) redirect(loginUrl('error=email', next));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // One message for wrong password, unknown email and unconfirmed account —
  // telling them apart would let anyone probe for registered addresses.
  if (error) redirect(loginUrl('error=credentials', next));

  redirect(next ?? '/dashboard');
}

export async function signUp(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNextPath(String(formData.get('next') ?? ''));
  if (!EMAIL_RE.test(email)) redirect(loginUrl('error=email', next));
  if (password.length < MIN_PASSWORD) redirect(loginUrl('error=weak', next));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl(next) },
  });
  if (error) redirect(loginUrl('error=signup', next));

  redirect(loginUrl('confirm=1', next));
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (!EMAIL_RE.test(email)) redirect('/login/forgot?error=email');

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${authCallbackUrl()}?next=/auth/update-password`,
  });

  // Reported as sent either way — whether the address has an account isn't public.
  redirect('/login?reset=1');
}
