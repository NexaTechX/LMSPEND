import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdminEmail, passcodeRequired, passcodeUnlocked } from '@/lib/admin';
import { currentUserEmail } from '@/lib/auth';
import { PLAN_PRICES_USD } from '@/lib/billing/types';
import { effectivePlan, isPaid, planBadge } from '@/lib/plan';
import { pageMetadata } from '@/lib/seo';
import { getStore } from '@/lib/store';
import { grantPlan, lockAdmin, revokePlan, submitPasscode } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Admin',
  description: 'LMSpend owner console.',
  path: '/admin',
  index: false,
});

const usd = (n: number) => `$${n.toFixed(2)}`;

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function PasscodeGate({ bad }: { bad: boolean }) {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Admin passcode</h1>
        <p className="muted">Second lock on the owner console. Enter your admin passcode.</p>
        {bad && <div className="notice notice-err">Wrong passcode. Try again.</div>}
        <form action={submitPasscode}>
          <input
            name="passcode"
            type="password"
            autoComplete="off"
            placeholder="passcode"
            className="input"
            required
            autoFocus
          />
          <button type="submit" className="btn btn-primary btn-block">Unlock</button>
        </form>
        <p className="muted small"><Link href="/dashboard">← back to dashboard</Link></p>
      </div>
    </main>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const email = await currentUserEmail();
  if (!(await isAdminEmail(email))) notFound(); // don't reveal the route exists to non-admins

  if (passcodeRequired() && !(await passcodeUnlocked())) {
    const { bad } = await searchParams;
    return <PasscodeGate bad={bad === '1'} />;
  }
  const admin = email!;

  const store = getStore();
  const month = currentMonth();
  const [users, teams, waitlist] = await Promise.all([
    store.listUsers(),
    store.countTeams(),
    store.listWaitlist(),
  ]);

  // Per-user current-month spend + roll-ups (small scale: fine to fan out).
  const rows = await Promise.all(
    users.map(async (u) => {
      const months = await store.getSpend(u.email);
      const cur = months.find((m) => m.month === month);
      return {
        user: u,
        monthSpend: cur?.estimatedTotalUsd ?? 0,
        lastSync: months[0]?.syncedAt ?? null,
        monthsTracked: months.length,
      };
    }),
  );

  const paid = rows.filter((r) => isPaid(r.user));
  const mrr = paid.reduce((s, r) => s + PLAN_PRICES_USD[effectivePlan(r.user) as 'solo' | 'team'], 0);
  const trackedThisMonth = rows.reduce((s, r) => s + r.monthSpend, 0);
  rows.sort((a, b) => Number(isPaid(b.user)) - Number(isPaid(a.user)) || b.monthSpend - a.monthSpend);

  const waitlistCsv = `data:text/csv;charset=utf-8,${encodeURIComponent(
    'email,tool,created_at\n' + waitlist.map((w) => `${w.email},${w.tool},${w.createdAt}`).join('\n'),
  )}`;

  return (
    <main>
      <div className="page-head">
        <h1>Admin</h1>
        <span className="muted small" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          owner console · {admin}
          {passcodeRequired() && (
            <form action={lockAdmin}>
              <button type="submit" className="btn btn-ghost btn-sm">Lock</button>
            </form>
          )}
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">MRR</div>
          <div className="value">{usd(mrr)}</div>
          <div className="sub">{paid.length} paying · goal $5,000</div>
        </div>
        <div className="stat">
          <div className="label">Users</div>
          <div className="value">{users.length}</div>
          <div className="sub">{paid.length} paid · {users.length - paid.length} free</div>
        </div>
        <div className="stat">
          <div className="label">Teams</div>
          <div className="value">{teams}</div>
          <div className="sub">workspaces created</div>
        </div>
        <div className="stat">
          <div className="label">Tracked · {month}</div>
          <div className="value" style={{ fontSize: 22 }}>{usd(trackedThisMonth)}</div>
          <div className="sub">AI spend flowing through</div>
        </div>
      </div>

      <div className="panel">
        <h2>Grant / comp a plan<span className="hint">fix a failed webhook, or gift access</span></h2>
        <form action={grantPlan} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input name="email" type="email" placeholder="email@user.com" className="input" style={{ maxWidth: 260, margin: 0 }} required />
          <select name="plan" className="input" style={{ maxWidth: 110, margin: 0 }} defaultValue="solo">
            <option value="solo">solo</option>
            <option value="team">team</option>
          </select>
          <input name="days" type="number" min="1" defaultValue={31} className="input" style={{ maxWidth: 90, margin: 0 }} />
          <span className="muted small">days</span>
          <button type="submit" className="btn btn-primary btn-sm">Grant</button>
        </form>
      </div>

      <div className="panel">
        <h2>Users<span className="hint">{users.length} total</span></h2>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Email</th><th>Plan</th><th className="num">{month}</th>
                <th>Renews / until</th><th>Last sync</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, monthSpend, lastSync }) => {
                const badge = planBadge(user);
                return (
                  <tr key={user.email}>
                    <td className="mono">{user.email}</td>
                    <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    <td className="num">{monthSpend > 0 ? usd(monthSpend) : '—'}</td>
                    <td className="muted small">
                      {user.paidUntil ? new Date(user.paidUntil).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="muted small">
                      {lastSync ? new Date(lastSync).toISOString().slice(0, 10) : 'never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isPaid(user) && (
                        <form action={revokePlan}>
                          <input type="hidden" name="email" value={user.email} />
                          <button type="submit" className="btn btn-danger btn-sm">Revoke</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="muted">No users yet. Sign-ups appear here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>
          Waitlist<span className="hint">{waitlist.length} signups</span>
          {waitlist.length > 0 && (
            <a href={waitlistCsv} download="lmspend-waitlist.csv" className="btn btn-ghost btn-sm" style={{ float: 'right' }}>
              Export CSV
            </a>
          )}
        </h2>
        {waitlist.length === 0 ? (
          <p className="muted small">No waitlist signups yet. The Cursor page feeds this list.</p>
        ) : (
          <table>
            <thead><tr><th>Email</th><th>Tool</th><th>When</th></tr></thead>
            <tbody>
              {waitlist.slice(0, 50).map((w) => (
                <tr key={`${w.tool}:${w.email}`}>
                  <td className="mono">{w.email}</td>
                  <td>{w.tool}</td>
                  <td className="muted small">{new Date(w.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="muted small">
        <Link href="/dashboard">← back to your dashboard</Link>
      </p>
    </main>
  );
}
