import Link from 'next/link';
import { isDevMode } from '@/lib/auth';
import { signInWithEmail, signInWithGitHub } from './actions';

export const dynamic = 'force-dynamic';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (isDevMode()) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
          <h1>Dev mode</h1>
          <p className="muted">
            Supabase isn&apos;t configured yet, so sign-in is off and the dashboard uses a local
            dev identity. Add the Supabase keys to <code>.env.local</code> to turn on real accounts.
          </p>
          <Link className="btn btn-primary btn-block" href="/dashboard">Open dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Sign in</h1>
        <p className="muted">No password — we email you a sign-in link.</p>

        {params.sent ? (
          <div className="notice notice-ok">
            Link sent. Check your inbox and open it on this device.
          </div>
        ) : (
          <>
            <form action={signInWithEmail}>
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
              <button type="submit" className="btn btn-primary btn-block">
                Email me a sign-in link
              </button>
            </form>

            <div className="divider"><span>or</span></div>

            <form action={signInWithGitHub}>
              <button type="submit" className="btn btn-ghost btn-block">
                Continue with GitHub
              </button>
            </form>
          </>
        )}

        {params.error && (
          <div className="notice notice-err">
            {params.error === 'email' && 'That email doesn’t look right — try again.'}
            {params.error === 'send' && 'Couldn’t send the link. Wait a minute and try again.'}
            {params.error === 'github' && 'GitHub sign-in failed. Try the email link instead.'}
            {params.error === 'auth' && 'That link expired or was already used. Request a new one.'}
          </div>
        )}

        <p className="muted small">
          Signing in creates your account. Sync stays opt-in either way.
        </p>
      </div>
    </main>
  );
}
