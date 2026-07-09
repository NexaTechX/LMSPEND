import Link from 'next/link';
import { isDevMode } from '@/lib/auth';
import { signIn, signUp } from './actions';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  email: 'That email doesn’t look right — try again.',
  credentials: 'Wrong email or password. If you just signed up, confirm your email first.',
  weak: 'Passwords need at least 8 characters.',
  signup: 'Couldn’t create that account. Wait a minute and try again.',
  auth: 'That link expired or was already used. Request a new one.',
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; confirm?: string; reset?: string; error?: string }>;
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
        <p className="muted">Email and password. New here? Create an account with the same form.</p>

        {params.confirm && (
          <div className="notice notice-ok">
            Account created. Open the confirmation link we emailed you, then sign in.
          </div>
        )}
        {params.reset && (
          <div className="notice notice-ok">
            If that email has an account, a reset link is on its way.
          </div>
        )}
        {params.error && (
          <div className="notice notice-err">
            {ERRORS[params.error] ?? 'Something went wrong — try again.'}
          </div>
        )}

        <form action={signIn}>
          {params.next && <input type="hidden" name="next" value={params.next} />}

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

          <label className="field-label" htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="input"
            autoComplete="current-password"
          />

          <button type="submit" className="btn btn-primary btn-block">Sign in</button>
          <button type="submit" formAction={signUp} className="btn btn-ghost btn-block">
            Create account
          </button>
        </form>

        <p className="muted small">
          <Link href="/login/forgot">Forgot your password?</Link>
        </p>

        <p className="muted small">
          Creating an account is free. Sync stays opt-in either way.
        </p>
      </div>
    </main>
  );
}
