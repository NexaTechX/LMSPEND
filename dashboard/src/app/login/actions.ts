'use server';

import { redirect } from 'next/navigation';
import { authCallbackUrl } from '@/lib/app-url';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect('/login?error=email');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  });

  redirect(error ? '/login?error=send' : '/login?sent=1');
}

export async function signInWithGitHub(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: authCallbackUrl() },
  });
  if (error || !data.url) redirect('/login?error=github');
  redirect(data.url);
}
