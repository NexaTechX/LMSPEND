import Link from 'next/link';
import { isAdminEmail } from '@/lib/admin';
import { currentUserEmail, isDevMode } from '@/lib/auth';
import { planBadge } from '@/lib/plan';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const email = await currentUserEmail();
  const user = email ? await getStore().ensureUser(email) : null;
  const admin = isAdminEmail(email);

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <nav aria-label="App">
          <Link href="/dashboard" className="side-link"><span className="k">~</span> Overview</Link>
          <Link href="/team" className="side-link"><span className="k">⁂</span> Team</Link>
          <Link href="/settings" className="side-link"><span className="k">⚙</span> Settings</Link>
          {admin && <Link href="/admin" className="side-link"><span className="k">★</span> Admin</Link>}
        </nav>
        <div className="spacer" />
        <div className="side-user">
          <div className="email">{email ?? 'not signed in'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            {user ? (
              <span className={`badge ${planBadge(user).className}`}>{planBadge(user).label}</span>
            ) : (
              <span className="badge">dev</span>
            )}
          </div>
          {isDevMode() ? (
            <div className="muted small" style={{ marginTop: 8 }}>dev mode — no sign-in</div>
          ) : (
            <form action="/auth/signout" method="post" style={{ marginTop: 10 }}>
              <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
            </form>
          )}
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
