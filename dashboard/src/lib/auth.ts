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
