import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdminEmail, passcodeRequired, passcodeUnlocked } from '@/lib/admin';
import {
  currentUtcMonth,
  getAdminOverview,
  getSystemHealth,
  listAdminAudit,
  listAdminUsersPage,
  listWaitlistEntries,
} from '@/lib/admin-ops';
import type { AdminUserFilter } from '@/lib/admin-types';
import { currentUserEmail } from '@/lib/auth';
import { isComped, isPaid, planBadge } from '@/lib/plan';
import { pageMetadata } from '@/lib/seo';
import {
  lockAdmin,
  submitPasscode,
  updateWaitlistStatus,
} from './actions';
import { ConfirmGrantForm, ConfirmPromoteForm, ConfirmRevokeForm } from './confirm-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Admin',
  description: 'LMSpend owner console.',
  path: '/admin',
  index: false,
});

const usd = (n: number) => `$${n.toFixed(2)}`;

const FLASH_OK: Record<string, string> = {
  granted: 'Plan granted.',
  revoked: 'Access revoked.',
  promoted: 'Admin promoted.',
  demoted: 'Admin demoted.',
  waitlist_updated: 'Waitlist updated.',
  notes_saved: 'Notes saved.',
  past_due: 'Marked past due.',
  extended: 'Access extended.',
};

const FLASH_ERR: Record<string, string> = {
  unauthorized: 'Not authorized.',
  invalid_grant: 'Invalid grant input.',
  invalid_email: 'Invalid email.',
  reason_required: 'A reason is required.',
  not_found: 'User not found.',
  cannot_demote_self: 'You cannot demote yourself.',
  last_admin: 'Cannot demote the last admin.',
  invalid_waitlist: 'Invalid waitlist update.',
  locked: 'Too many failed passcode attempts. Try again in 15 minutes.',
};

function PasscodeGate({ bad, locked }: { bad: boolean; locked: boolean }) {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Admin passcode</h1>
        <p className="muted">Second lock on the owner console. Enter your admin passcode.</p>
        {locked && <div className="notice notice-err">{FLASH_ERR.locked}</div>}
        {bad && !locked && <div className="notice notice-err">Wrong passcode. Try again.</div>}
        <form action={submitPasscode}>
          <input
            name="passcode"
            type="password"
            autoComplete="off"
            placeholder="passcode"
            className="input"
            required
            autoFocus
            disabled={locked}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={locked}>
            Unlock
          </button>
        </form>
        <p className="muted small"><Link href="/dashboard">← back to dashboard</Link></p>
      </div>
    </main>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    bad?: string;
    err?: string;
    ok?: string;
    email?: string;
    q?: string;
    filter?: string;
    page?: string;
  }>;
}) {
  const email = await currentUserEmail();
  if (!(await isAdminEmail(email))) notFound();

  const sp = await searchParams;

  if (passcodeRequired() && !(await passcodeUnlocked())) {
    return <PasscodeGate bad={sp.bad === '1'} locked={sp.err === 'locked'} />;
  }
  const admin = email!;

  const month = currentUtcMonth();
  const q = sp.q ?? '';
  const filter = (
    ['all', 'paid', 'free', 'comp', 'admin'].includes(sp.filter ?? '')
      ? sp.filter
      : 'all'
  ) as AdminUserFilter;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const [overview, listed, waitlist, audit, health] = await Promise.all([
    getAdminOverview(month),
    listAdminUsersPage({ q, filter, page, pageSize: 25, month }),
    listWaitlistEntries(),
    listAdminAudit(30),
    getSystemHealth(),
  ]);

  const totalPages = Math.max(1, Math.ceil(listed.total / listed.pageSize));
  const exportUsersHref = `/api/admin/export?kind=users&q=${encodeURIComponent(q)}&filter=${filter}`;

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

      {sp.ok && FLASH_OK[sp.ok] && (
        <div className="notice notice-ok" style={{ marginBottom: 14 }}>
          {FLASH_OK[sp.ok]}{sp.email ? ` (${sp.email})` : ''}
        </div>
      )}
      {sp.err && FLASH_ERR[sp.err] && (
        <div className="notice notice-err" style={{ marginBottom: 14 }}>
          {FLASH_ERR[sp.err]}
        </div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="label">Paid MRR</div>
          <div className="value">{usd(overview.paidMrr)}</div>
          <div className="sub">{overview.paidCount} paying</div>
        </div>
        <div className="stat">
          <div className="label">Comped</div>
          <div className="value">{usd(overview.compedMrr)}</div>
          <div className="sub">{overview.compedCount} seats (not revenue)</div>
        </div>
        <div className="stat">
          <div className="label">Users</div>
          <div className="value">{overview.userCount}</div>
          <div className="sub">{overview.teamCount} teams</div>
        </div>
        <div className="stat">
          <div className="label">Tracked · {month}</div>
          <div className="value" style={{ fontSize: 22 }}>{usd(overview.trackedThisMonth)}</div>
          <div className="sub">AI spend flowing through</div>
        </div>
      </div>

      <div className="panel">
        <h2>System health</h2>
        <div className="muted small" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px' }}>
          <span>payments: {health.paymentsEnabled ? 'on' : 'off'}</span>
          <span>resend: {health.resendConfigured ? 'configured' : 'missing'}</span>
          <span>cron secret: {health.cronSecretConfigured ? 'set' : 'open'}</span>
          <span>supabase: {health.supabaseConfigured ? 'live' : 'dev memory'}</span>
          <span>last cron: {fmtTime(health.lastCronAt)}</span>
          <span>last billing webhook: {fmtTime(health.lastWebhookAt)}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Grant / comp a plan<span className="hint">reason required · marked as comp</span></h2>
        <ConfirmGrantForm />
      </div>

      <div className="panel">
        <h2>
          Users
          <span className="hint">{listed.total} match · page {listed.page}/{totalPages}</span>
          <a href={exportUsersHref} className="btn btn-ghost btn-sm" style={{ float: 'right' }}>
            Export CSV
          </a>
        </h2>

        <form method="get" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input
            name="q"
            defaultValue={q}
            placeholder="search email"
            className="input"
            style={{ maxWidth: 240, margin: 0 }}
          />
          <select name="filter" defaultValue={filter} className="input" style={{ maxWidth: 140, margin: 0 }}>
            <option value="all">all</option>
            <option value="paid">paid</option>
            <option value="comp">comp</option>
            <option value="free">free</option>
            <option value="admin">admins</option>
          </select>
          <button type="submit" className="btn btn-ghost btn-sm">Filter</button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th className="num">{month}</th>
                <th>Until</th>
                <th>Last sync</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listed.rows.map(({ user, monthSpend, lastSync }) => {
                const badge = planBadge(user);
                return (
                  <tr key={user.email}>
                    <td className="mono">
                      <Link href={`/admin/users/${encodeURIComponent(user.email)}`}>
                        {user.email}
                      </Link>
                      {user.isAdmin && <span className="badge" style={{ marginLeft: 6 }}>admin</span>}
                      {isComped(user) && <span className="badge badge-amber" style={{ marginLeft: 6 }}>comp</span>}
                    </td>
                    <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>
                    <td className="num">{monthSpend > 0 ? usd(monthSpend) : '—'}</td>
                    <td className="muted small">
                      {user.paidUntil ? new Date(user.paidUntil).toISOString().slice(0, 10) : '—'}
                    </td>
                    <td className="muted small">
                      {lastSync ? new Date(lastSync).toISOString().slice(0, 10) : 'never'}
                    </td>
                    <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <ConfirmPromoteForm email={user.email} isAdmin={user.isAdmin} />
                      {isPaid(user) && <ConfirmRevokeForm email={user.email} />}
                    </td>
                  </tr>
                );
              })}
              {listed.rows.length === 0 && (
                <tr><td colSpan={6} className="muted">No users match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {page > 1 && (
              <Link
                className="btn btn-ghost btn-sm"
                href={`/admin?q=${encodeURIComponent(q)}&filter=${filter}&page=${page - 1}`}
              >
                ← prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                className="btn btn-ghost btn-sm"
                href={`/admin?q=${encodeURIComponent(q)}&filter=${filter}&page=${page + 1}`}
              >
                next →
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>
          Waitlist
          <span className="hint">{waitlist.length} signups</span>
          {waitlist.length > 0 && (
            <a href="/api/admin/export?kind=waitlist" className="btn btn-ghost btn-sm" style={{ float: 'right' }}>
              Export CSV
            </a>
          )}
        </h2>
        {waitlist.length === 0 ? (
          <p className="muted small">No waitlist signups yet.</p>
        ) : (
          <table>
            <thead><tr><th>Email</th><th>Tool</th><th>Status</th><th>When</th></tr></thead>
            <tbody>
              {waitlist.slice(0, 50).map((w) => (
                <tr key={`${w.tool}:${w.email}`}>
                  <td className="mono">{w.email}</td>
                  <td>{w.tool}</td>
                  <td>
                    <form action={updateWaitlistStatus} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="hidden" name="email" value={w.email} />
                      <input type="hidden" name="tool" value={w.tool} />
                      <select name="status" defaultValue={w.status} className="input" style={{ margin: 0, maxWidth: 130 }}>
                        <option value="new">new</option>
                        <option value="contacted">contacted</option>
                        <option value="converted">converted</option>
                      </select>
                      <button type="submit" className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td className="muted small">{new Date(w.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Recent activity<span className="hint">{audit.length} events</span></h2>
        {audit.length === 0 ? (
          <p className="muted small">No admin actions logged yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="muted small">{fmtTime(a.createdAt)}</td>
                  <td className="mono small">{a.actorEmail}</td>
                  <td>{a.action}</td>
                  <td className="mono small">
                    {a.targetEmail ? (
                      <Link href={`/admin/users/${encodeURIComponent(a.targetEmail)}`}>{a.targetEmail}</Link>
                    ) : '—'}
                  </td>
                  <td className="muted small">{a.reason ?? '—'}</td>
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
