import Link from 'next/link';
import { CostMath } from '@/components/cost-math';
import { LiveRefresh } from '@/components/live-refresh';
import { resolveAppUrl } from '@/lib/app-url';
import { currentUserEmail } from '@/lib/auth';
import { can } from '@/lib/plan';
import { getStore, topPercentile, type SpendBucket } from '@/lib/store';

export const dynamic = 'force-dynamic';

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function sorted(data: Record<string, SpendBucket>, limit = 10): Array<[string, SpendBucket]> {
  return Object.entries(data).sort((a, b) => b[1].cost - a[1].cost).slice(0, limit);
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function BarPanel({ title, hint, data }: { title: string; hint?: string; data: Record<string, SpendBucket> }) {
  const rows = sorted(data);
  if (!rows.length) return null;
  const max = rows[0][1].cost || 1;
  return (
    <div className="panel">
      <h2>{title}{hint && <span className="hint">{hint}</span>}</h2>
      <table>
        <tbody>
          {rows.map(([name, b]) => (
            <tr key={name}>
              <td className="mono" style={{ width: '34%' }}>{name}</td>
              <td>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(b.cost / max) * 100}%` }} />
                </div>
              </td>
              <td className="num" style={{ width: 100 }}>{usd(b.cost)}</td>
              <td className="num muted small" style={{ width: 150 }}>
                {fmtTokens(b.inputTokens + b.cacheReadTokens + b.cacheWriteTokens)} in / {fmtTokens(b.outputTokens)} out
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayChart({ data, month }: { data: Record<string, SpendBucket>; month: string }) {
  const days = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  if (!days.length) return null;
  const max = Math.max(...days.map(([, b]) => b.cost)) || 1;
  return (
    <div className="panel">
      <h2>By day<span className="hint">{month}</span></h2>
      <div className="day-chart">
        {days.map(([day, b]) => (
          <div className="day-col" key={day} title={`${day}: ${usd(b.cost)}`}>
            <div className="fill" style={{ height: `${Math.max((b.cost / max) * 100, 2)}%` }} />
          </div>
        ))}
      </div>
      <div className="day-axis">
        <span>{days[0][0].slice(8)}</span>
        <span>{days[days.length - 1][0].slice(8)}</span>
      </div>
    </div>
  );
}

function Onboarding({ appUrl }: { appUrl: string }) {
  return (
    <div className="panel onboarding">
      <h2>Get your first sync in</h2>
      <div className="step-row">
        <span className="step-num">1</span>
        <div>
          <strong>Create an API key</strong>
          <p className="muted small">In <Link href="/settings">Settings</Link> — it&apos;s shown once, keep it somewhere safe.</p>
        </div>
      </div>
      <div className="step-row">
        <span className="step-num">2</span>
        <div style={{ width: '100%' }}>
          <strong>Run the CLI on your machine</strong>
          <div className="cmd"><span className="dollar">$</span> npx lmspend sync --url {appUrl} --key lm_live_…</div>
        </div>
      </div>
      <div className="step-row">
        <span className="step-num">3</span>
        <div>
          <strong>Refresh this page</strong>
          <p className="muted small">
            Sync sends aggregates only — costs, token counts, hashed project names. Never code,
            never prompts.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const email = await currentUserEmail();
  if (!email) return null; // middleware redirects before this happens

  const store = getStore();
  const user = await store.ensureUser(email);
  const access = can(user);
  const allMonths = await store.getSpend(email);
  const months = access.history ? allMonths : allMonths.slice(0, 1);
  const lockedMonths = allMonths.length - months.length;
  const budget = access.budgets ? await store.getBudget(email) : null;
  const current = months[0];
  const previous = months[1];
  const appUrl = resolveAppUrl();

  if (!current) {
    return (
      <main>
        <div className="page-head"><h1>Overview</h1></div>
        <Onboarding appUrl={appUrl} />
      </main>
    );
  }

  const delta =
    previous && previous.estimatedTotalUsd > 0
      ? ((current.estimatedTotalUsd - previous.estimatedTotalUsd) / previous.estimatedTotalUsd) * 100
      : null;
  const topModel = sorted(current.byModel, 1)[0];
  const topDay = sorted(current.byDay, 1)[0];
  const totals = await getStore().getMonthTotals(current.month);
  const percentile = totals.length > 1 ? topPercentile(totals, current.estimatedTotalUsd) : null;

  return (
    <main>
      <div className="page-head">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          Overview
          {access.realtime && user.realtimeEnabled && <LiveRefresh />}
        </h1>
        <span className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <a href={`/api/share-card?month=${current.month}`} download={`lmspend-${current.month}.png`} className="btn btn-ghost btn-sm">
            Download share card ↓
          </a>
          <span>last sync {new Date(current.syncedAt).toLocaleString()}</span>
          {access.history && <a href={`/api/export?month=${current.month}`}>export CSV</a>}
          <Link href="/settings">sync another machine →</Link>
        </span>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="label">{current.month} · est. total</div>
          <div className="value">{usd(current.estimatedTotalUsd)}</div>
          <div className="sub">
            {percentile !== null ? `top ${percentile}% of synced spenders` : 'at API list prices'}
          </div>
        </div>
        <div className="stat">
          <div className="label">vs last month</div>
          <div className={`value ${delta === null ? '' : delta >= 0 ? 'up' : 'down'}`}>
            {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`}
          </div>
          <div className="sub">{previous ? previous.month : 'no earlier data yet'}</div>
        </div>
        {current.roiMultiple !== null && current.roiMultiple !== undefined ? (
          <div className="stat">
            <div className="label">value vs your plan</div>
            <div className="value" style={{ color: 'var(--amber-bright)' }}>
              {current.roiMultiple.toFixed(1)}×
            </div>
            <div className="sub">
              {current.planMonthly ? `${usd(current.estimatedTotalUsd)} on a $${current.planMonthly.toFixed(0)}/mo plan` : ''}
            </div>
          </div>
        ) : (
          <div className="stat">
            <div className="label">top model</div>
            <div className="value" style={{ fontSize: 16 }}>{topModel?.[0] ?? '—'}</div>
            <div className="sub">{topModel ? usd(topModel[1].cost) : ''}</div>
          </div>
        )}
        <div className="stat">
          <div className="label">most expensive day</div>
          <div className="value" style={{ fontSize: 16 }}>{topDay?.[0] ?? '—'}</div>
          <div className="sub">{topDay ? usd(topDay[1].cost) : ''}</div>
        </div>
      </div>

      {budget !== null && (
        <div className="panel">
          <h2>Budget<span className="hint">${budget.toFixed(0)}/month · alerts on</span></h2>
          <div className="bar-track" style={{ height: 14 }}>
            <div
              className="bar-fill"
              style={{
                height: 14,
                width: `${Math.min((current.estimatedTotalUsd / budget) * 100, 100)}%`,
                background: current.estimatedTotalUsd > budget ? 'var(--red)' : 'var(--amber)',
              }}
            />
          </div>
          <p className="muted small" style={{ marginTop: 8 }}>
            {usd(current.estimatedTotalUsd)} of {usd(budget)}
            {current.estimatedTotalUsd > budget
              ? ' — over budget; alert email sent'
              : ` — ${usd(budget - current.estimatedTotalUsd)} left this month`}
          </p>
        </div>
      )}

      <BarPanel title="By tool" data={current.byTool} />
      <BarPanel title="By model" data={current.byModel} />
      <CostMath data={current.byModel} />
      <DayChart data={current.byDay} month={current.month} />
      <BarPanel
        title="By project"
        hint="names are hashed before they leave your machine"
        data={current.byProject}
      />

      {months.length > 1 && (
        <div className="panel">
          <h2>History</h2>
          <table>
            <thead>
              <tr><th>Month</th><th className="num">Est. total</th><th className="num">Synced</th></tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="mono">{m.month}</td>
                  <td className="num">{usd(m.estimatedTotalUsd)}</td>
                  <td className="num muted small">{new Date(m.syncedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!access.history && (
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">
              {lockedMonths > 0
                ? `${lockedMonths} earlier month${lockedMonths > 1 ? 's' : ''} stored and waiting`
                : 'History & trends'}
            </span>
            <Link href="/api/checkout?plan=solo" className="btn btn-primary btn-sm">
              Unlock with Solo — $19/mo
            </Link>
          </div>
          <p>
            Every sync is saved — month-over-month trends, budget alerts, and your monthly email
            report unlock the moment you upgrade. Nothing is deleted while you decide.
          </p>
        </div>
      )}

      {!access.budgets && budget === null && (
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">Budget alerts</span>
            <Link href="/api/checkout?plan=solo" className="btn btn-ghost btn-sm">Solo — $19/mo</Link>
          </div>
          <p>
            &quot;Email me before the month passes $300&quot; — plus an automatic alert when any single
            day runs 3× your average. Catch the runaway agent session before the invoice does.
          </p>
        </div>
      )}
    </main>
  );
}
