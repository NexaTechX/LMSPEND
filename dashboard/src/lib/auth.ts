import { supabaseConfigured } from './supabase/config';
import { createSupabaseServerClient } from './supabase/server';

/**
 * The signed-in user's email, or the dev identity when Supabase isn't configured.
 * Returns null when Supabase IS configured but nobody is signed in
 * (middleware should have redirected before that happens on protected pages).
 */
export async function currentUserEmail(): Promise<string | null> {
  if (!supabaseConfigured()) {
    const first = (process.env.LMSPEND_DEV_KEYS ?? '').split(',')[0];
    return first?.split(':')[1]?.trim() || 'dev@example.com';
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export function isDevMode(): boolean {
  return !supabaseConfigured();
}

/**
 * A `?next=` destination that cannot leave this origin.
 * Rejects absolute URLs and protocol-relative paths ("//evil.com", "/\evil.com").
 * Returns null when there's nothing safe to redirect to.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/')) return null;
  if (next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
