import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isDevMode } from '@/lib/auth';
import { pageMetadata } from '@/lib/seo';
import { requestPasswordReset } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Reset password',
  description: 'Reset your LMSpend account password.',
  path: '/login/forgot',
  index: false,
});

export default async function Forgot({
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
        <h1>Reset password</h1>
        <p className="muted">We&apos;ll email you a link to set a new one.</p>

        {error && (
          <div className="notice notice-err">That email doesn’t look right — try again.</div>
        )}

        <form action={requestPasswordReset}>
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
            className="input"
            autoComplete="email"
          />
          <button type="submit" className="btn btn-primary btn-block">Email me a reset link</button>
        </form>

        <p className="muted small">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
