import Link from 'next/link';
import { cookies } from 'next/headers';
import { CostMath } from '@/components/cost-math';
import { currentUserEmail } from '@/lib/auth';
import { can } from '@/lib/plan';
import { getStore, TEAM_SEATS, type SpendBucket } from '@/lib/store';
import { createInvite, createTeam, removeMember } from './actions';

export const dynamic = 'force-dynamic';

const usd = (n: number) => `$${n.toFixed(2)}`;

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function TeamPage() {
  const email = await currentUserEmail();
  if (!email) return null;

  const store = getStore();
  const user = await store.ensureUser(email);
  const access = can(user);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!access.teamFeatures) {
    return (
      <main>
        <div className="page-head"><h1>Team</h1></div>
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">Team workspace</span>
            <Link href="/api/checkout?plan=team" className="btn btn-primary btn-sm">
              Unlock with Team — $49/mo
            </Link>
          </div>
          <p>
            One roll-up for every seat: who&apos;s spending what, across every AI coding tool.
            Invite up to {TEAM_SEATS} people with a link — they sync with their own free accounts,
            you see the whole picture. Budget alerts cover the team total.
          </p>
        </div>
      </main>
    );
  }

  const team = await store.getTeam(email);

  if (!team) {
    return (
      <main>
        <div className="page-head"><h1>Team</h1></div>
        <div className="panel">
          <h2>Create your workspace</h2>
          <form action={createTeam} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              name="name"
              className="input"
              placeholder="Team name (e.g. Acme Engineering)"
              style={{ maxWidth: 320, margin: 0 }}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm">Create team</button>
          </form>
          <p className="muted small" style={{ marginTop: 10 }}>
            You&apos;ll get an invite link for up to {TEAM_SEATS} seats. Members join free — your
            plan covers the workspace.
          </p>
        </div>
      </main>
    );
  }

  // Roll-up: current month across every member.
  const month = currentMonth();
  const rollup: Array<{ email: string; role: string; total: number }> = [];
  const byTool = new Map<string, number>();
  const byModel: Record<string, SpendBucket> = {};
  const addBucket = (into: Record<string, SpendBucket>, key: string, b: SpendBucket) => {
    const acc = into[key] ?? { cost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, events: 0 };
    acc.cost += b.cost;
    acc.inputTokens += b.inputTokens;
    acc.outputTokens += b.outputTokens;
    acc.cacheReadTokens += b.cacheReadTokens;
    acc.cacheWriteTokens += b.cacheWriteTokens;
    acc.events += b.events;
    into[key] = acc;
  };
  for (const m of team.members) {
    const months = await store.getSpend(m.email);
    const cur = months.find((x) => x.month === month);
    rollup.push({ email: m.email, role: m.role, total: cur?.estimatedTotalUsd ?? 0 });
    for (const [tool, b] of Object.entries(cur?.byTool ?? {})) {
      byTool.set(tool, (byTool.get(tool) ?? 0) + (b as SpendBucket).cost);
    }
    for (const [model, b] of Object.entries(cur?.byModel ?? {})) {
      addBucket(byModel, model, b as SpendBucket);
    }
  }
  rollup.sort((a, b) => b.total - a.total);
  const teamTotal = rollup.reduce((s, r) => s + r.total, 0);
  const maxMember = rollup[0]?.total || 1;
  const byModelMax = Math.max(0, ...Object.values(byModel).map((b) => b.cost));

  const cookieStore = await cookies();
  const inviteToken = cookieStore.get('lmspend_invite_token')?.value ?? null;

  return (
    <main>
      <div className="page-head">
        <h1>{team.name}</h1>
        <span className="muted small">{team.members.length}/{TEAM_SEATS} seats · {month}</span>
      </div>

      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="stat">
          <div className="label">team total · {month}</div>
          <div className="value">{usd(teamTotal)}</div>
          <div className="sub">at API list prices, all members</div>
        </div>
        <div className="stat">
          <div className="label">top tool</div>
          <div className="value" style={{ fontSize: 16 }}>
            {[...byTool.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'}
          </div>
          <div className="sub">across the whole team</div>
        </div>
      </div>

      <div className="panel">
        <h2>By member</h2>
        <table>
          <tbody>
            {rollup.map((r) => (
              <tr key={r.email}>
                <td style={{ width: '34%' }}>
                  {r.email} {r.role === 'owner' && <span className="badge">owner</span>}
                </td>
                <td>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(r.total / maxMember) * 100}%` }} />
                  </div>
                </td>
                <td className="num" style={{ width: 100 }}>{usd(r.total)}</td>
                {team.role === 'owner' && (
                  <td style={{ width: 90, textAlign: 'right' }}>
                    {r.role !== 'owner' && (
                      <form action={removeMember}>
                        <input type="hidden" name="email" value={r.email} />
                        <button type="submit" className="btn btn-danger btn-sm">Remove</button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 10 }}>
          Members showing $0.00 haven&apos;t synced this month — they run <code>lmspend sync</code>
          with their own API key.
        </p>
      </div>

      {Object.keys(byModel).length > 0 && (
        <div className="panel">
          <h2>By model<span className="hint">whole team, {month}</span></h2>
          <table>
            <tbody>
              {Object.entries(byModel).sort((a, b) => b[1].cost - a[1].cost).slice(0, 12).map(([model, b]) => (
                <tr key={model}>
                  <td className="mono" style={{ width: '40%' }}>{model}</td>
                  <td>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${(b.cost / (byModelMax || 1)) * 100}%` }} />
                    </div>
                  </td>
                  <td className="num" style={{ width: 100 }}>{usd(b.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CostMath data={byModel} label={`whole team · ${month}`} />

      {team.role === 'owner' && (
        <div className="panel">
          <h2>Invite people<span className="hint">link works until seats are full</span></h2>
          {inviteToken ? (
            <>
              <div className="key-new">{appUrl}/join/{inviteToken}</div>
              <p className="muted small" style={{ margin: '10px 0' }}>
                Send this to your teammates — they sign in and land in the workspace.
              </p>
            </>
          ) : (
            <p className="muted small" style={{ marginBottom: 12 }}>
              Generate a link and share it — no email invitations to manage.
            </p>
          )}
          {team.members.length < TEAM_SEATS ? (
            <form action={createInvite}>
              <button type="submit" className="btn btn-primary btn-sm">
                {inviteToken ? 'Generate a new link' : 'Generate invite link'}
              </button>
            </form>
          ) : (
            <p className="muted small">All {TEAM_SEATS} seats are in use. Extra seats ($8/seat) — email us.</p>
          )}
        </div>
      )}
    </main>
  );
}
