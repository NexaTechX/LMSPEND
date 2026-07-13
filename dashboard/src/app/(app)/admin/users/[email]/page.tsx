import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdminEmail, passcodeRequired, passcodeUnlocked } from '@/lib/admin';
import { getAdminUserDetail } from '@/lib/admin-ops';
import { currentUserEmail } from '@/lib/auth';
import { isPaid, planBadge } from '@/lib/plan';
import { pageMetadata } from '@/lib/seo';
import {
  extendAccess,
  markPastDue,
  saveAdminNotes,
} from '../../actions';
import { ConfirmPromoteForm, ConfirmRevokeForm } from '../../confirm-forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ email: string }>;
}): Promise<Metadata> {
  const { email } = await params;
  return pageMetadata({
    title: `Admin · ${decodeURIComponent(email)}`,
    description: 'LMSpend user detail.',
    path: `/admin/users/${email}`,
    index: false,
  });
}

const usd = (n: number) => `$${n.toFixed(2)}`;

const FLASH_OK: Record<string, string> = {
  notes_saved: 'Notes saved.',
  past_due: 'Marked past due.',
  extended: 'Access extended.',
};

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ email: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const adminEmail = await currentUserEmail();
  if (!(await isAdminEmail(adminEmail))) notFound();
  if (passcodeRequired() && !(await passcodeUnlocked())) {
    notFound();
  }

  const { email: raw } = await params;
  const email = decodeURIComponent(raw).toLowerCase();
  const detail = await getAdminUserDetail(email);
  if (!detail) notFound();

  const sp = await searchParams;
  const { user, spend, keys, team, budget, slackWebhook } = detail;
  const badge = planBadge(user);

  return (
    <main>
      <div className="page-head">
        <h1 className="mono" style={{ fontSize: 22 }}>{user.email}</h1>
        <span className="muted small">
          <Link href="/admin">← admin</Link>
        </span>
      </div>

      {sp.ok && FLASH_OK[sp.ok] && (
        <div className="notice notice-ok" style={{ marginBottom: 14 }}>{FLASH_OK[sp.ok]}</div>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="label">Plan</div>
          <div className="value" style={{ fontSize: 20 }}>
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          </div>
          <div className="sub">{user.subscriptionStatus} · {user.accessSource}</div>
        </div>
        <div className="stat">
          <div className="label">Paid until</div>
          <div className="value" style={{ fontSize: 18 }}>
            {user.paidUntil ? new Date(user.paidUntil).toISOString().slice(0, 10) : '—'}
          </div>
          <div className="sub">{user.isAdmin ? 'admin' : 'user'}</div>
        </div>
        <div className="stat">
          <div className="label">Customer id</div>
          <div className="value" style={{ fontSize: 14 }}>
            {user.externalCustomerId ?? '—'}
          </div>
          <div className="sub">joined {user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Flags</div>
          <div className="value" style={{ fontSize: 14 }}>
            reports {user.emailReports ? 'on' : 'off'} · realtime {user.realtimeEnabled ? 'on' : 'off'}
          </div>
          <div className="sub">budget {budget === null ? 'none' : usd(budget)} · slack {slackWebhook ? 'set' : '—'}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Actions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <ConfirmPromoteForm email={user.email} isAdmin={user.isAdmin} />
          {isPaid(user) && <ConfirmRevokeForm email={user.email} />}
        </div>

        <form action={extendAccess} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <input type="hidden" name="email" value={user.email} />
          <span className="muted small">Extend</span>
          <input name="days" type="number" min="1" defaultValue={31} className="input" style={{ maxWidth: 80, margin: 0 }} />
          <input name="reason" required placeholder="reason" className="input" style={{ maxWidth: 200, margin: 0 }} />
          <button type="submit" className="btn btn-primary btn-sm">Extend</button>
        </form>

        <form action={markPastDue} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="hidden" name="email" value={user.email} />
          <input name="reason" required placeholder="reason for past_due" className="input" style={{ maxWidth: 260, margin: 0 }} />
          <button type="submit" className="btn btn-ghost btn-sm">Mark past due</button>
        </form>
      </div>

      <div className="panel">
        <h2>Support notes</h2>
        <form action={saveAdminNotes}>
          <input type="hidden" name="email" value={user.email} />
          <textarea
            name="notes"
            className="input"
            rows={4}
            defaultValue={user.adminNotes ?? ''}
            placeholder="Internal notes (webhook issues, comps, support context)…"
            style={{ width: '100%', marginBottom: 10 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">Save notes</button>
        </form>
      </div>

      <div className="panel">
        <h2>Team</h2>
        {team ? (
          <p className="muted small">
            {team.name} · role <strong>{team.role}</strong> · {team.members.length} members
            <br />
            {team.members.map((m) => `${m.email} (${m.role})`).join(', ')}
          </p>
        ) : (
          <p className="muted small">Not on a team.</p>
        )}
      </div>

      <div className="panel">
        <h2>API keys<span className="hint">{keys.length}</span></h2>
        {keys.length === 0 ? (
          <p className="muted small">No keys.</p>
        ) : (
          <table>
            <thead><tr><th>Prefix</th><th>Label</th><th>Created</th><th>Last used</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.keyPrefix}>
                  <td className="mono">{k.keyPrefix}…</td>
                  <td>{k.label || '—'}</td>
                  <td className="muted small">{new Date(k.createdAt).toISOString().slice(0, 10)}</td>
                  <td className="muted small">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toISOString().slice(0, 10) : 'never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>Spend history<span className="hint">{spend.length} months</span></h2>
        {spend.length === 0 ? (
          <p className="muted small">No synced spend.</p>
        ) : (
          <table>
            <thead><tr><th>Month</th><th className="num">Total</th><th>Synced</th></tr></thead>
            <tbody>
              {spend.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td className="num">{usd(m.estimatedTotalUsd)}</td>
                  <td className="muted small">{new Date(m.syncedAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
