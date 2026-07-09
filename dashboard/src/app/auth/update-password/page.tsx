import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isDevMode } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Reached with a recovery session from the reset email — middleware guards it. */
async function updatePassword(formData: FormData): Promise<void> {
  'use server';
  const password = String(formData.get('password') ?? '');
  if (password.length < 8) redirect('/auth/update-password?error=weak');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/auth/update-password?error=save');

  redirect('/dashboard');
}

export default async function UpdatePassword({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (isDevMode()) redirect('/login');
  const { error } = await searchParams;

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Set a new password</h1>
        <p className="muted">Pick something you haven&apos;t used elsewhere.</p>

        {error && (
          <div className="notice notice-err">
            {error === 'weak'
              ? 'Passwords need at least 8 characters.'
              : 'Couldn’t save that password. Request a fresh reset link and try again.'}
          </div>
        )}

        <form action={updatePassword}>
          <label className="field-label" htmlFor="password">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="input"
            autoComplete="new-password"
          />
          <button type="submit" className="btn btn-primary btn-block">Save password</button>
        </form>
      </div>
    </main>
  );
}
