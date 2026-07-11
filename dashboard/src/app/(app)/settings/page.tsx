import type { Metadata } from 'next';
import { UpgradeCta } from '@/components/upgrade-cta';
import { resolveAppUrl } from '@/lib/app-url';
import { currentUserEmail, isDevMode } from '@/lib/auth';
import { paymentsEnabled } from '@/lib/billing/types';
import { can, planBadge } from '@/lib/plan';
import { pageMetadata } from '@/lib/seo';
import { getStore } from '@/lib/store';
import { createApiKey, readNewKeyOnce, revokeApiKey, saveBudget, saveSlackWebhook, toggleEmailReports, toggleRealtime } from './actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Settings',
  description: 'LMSpend account settings, API keys, and billing.',
  path: '/settings',
  index: false,
});

export default async function Settings() {
  const email = await currentUserEmail();
  if (!email) return null;

  const store = getStore();
  const user = await store.ensureUser(email);
  const access = can(user);
  const badge = planBadge(user);
  const keys = await store.listApiKeys(email);
  const newKey = await readNewKeyOnce();
  const budget = access.budgets ? await store.getBudget(email) : null;
  const slackWebhook = access.budgets ? await store.getSlackWebhook(email) : null;
  const appUrl = resolveAppUrl();

  return (
    <main>
      <div className="page-head"><h1>Settings</h1></div>

      <div className="panel">
        <h2>API keys<span className="hint">used by the CLI to sync this account</span></h2>

        {newKey && (
          <>
            <p className="small" style={{ marginBottom: 8 }}>
              Your new key — copy it now, it won&apos;t be shown again:
            </p>
            <div className="key-new">{newKey}</div>
            <p className="muted small" style={{ margin: '10px 0 18px' }}>
              Use it: <code>lmspend sync --url {appUrl} --key {newKey.slice(0, 16)}…</code> or
              set <code>LMSPEND_KEY</code> in your shell.
            </p>
          </>
        )}

        {keys.length > 0 && (
          <table style={{ marginBottom: 18 }}>
            <thead>
              <tr><th>Key</th><th>Label</th><th>Created</th><th>Last used</th><th /></tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.keyPrefix} className="key-row">
                  <td className="mono">{k.keyPrefix}…</td>
                  <td>{k.label}</td>
                  <td className="muted small">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="muted small">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <form action={revokeApiKey}>
                      <input type="hidden" name="prefix" value={k.keyPrefix} />
                      <button type="submit" className="btn btn-danger btn-sm">Revoke</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createApiKey} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            name="label"
            className="input"
            placeholder="Label (e.g. work laptop)"
            style={{ maxWidth: 280, margin: 0 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">Create key</button>
        </form>
        {isDevMode() && (
          <p className="muted small" style={{ marginTop: 12 }}>
            Dev mode: keys live in memory and reset on restart. <code>dev-key-123</code> from
            .env.local also works.
          </p>
        )}
      </div>

      {access.budgets ? (
        <div className="panel">
          <h2>Budget alert<span className="hint">emails you when the month crosses your limit</span></h2>
          <form action={saveBudget} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="muted small">Alert me when monthly spend passes $</span>
            <input
              name="limit"
              type="number"
              min="0"
              step="1"
              defaultValue={budget ?? ''}
              placeholder="e.g. 300"
              className="input"
              style={{ maxWidth: 120, margin: 0 }}
            />
            <button type="submit" className="btn btn-primary btn-sm">Save budget</button>
          </form>
          <p className="muted small" style={{ marginTop: 10 }}>
            {budget !== null
              ? <>Current budget: ${budget.toFixed(0)}/month. Leave the field empty and save to remove it.</>
              : <>No budget set. You&apos;ll also get an automatic alert when any single day runs 3× your average.</>}
          </p>
          <form action={saveSlackWebhook} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
            <span className="muted small">Also post alerts to Slack:</span>
            <input
              name="webhook"
              type="url"
              defaultValue={slackWebhook ?? ''}
              placeholder="https://hooks.slack.com/services/…"
              className="input"
              style={{ maxWidth: 340, margin: 0 }}
            />
            <button type="submit" className="btn btn-ghost btn-sm">
              {slackWebhook ? 'Update webhook' : 'Connect Slack'}
            </button>
          </form>
          <p className="muted small" style={{ marginTop: 8 }}>
            Slack → Apps → Incoming Webhooks → copy the URL. Empty + save disconnects.
          </p>
        </div>
      ) : (
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">Budget alerts</span>
            <UpgradeCta href="/api/checkout?plan=solo" className="btn btn-primary btn-sm">Unlock with Solo — $19/mo</UpgradeCta>
          </div>
          <p>
            Set a monthly limit and get emailed before you cross it — plus automatic alerts when a
            single day runs 3× your average.
          </p>
        </div>
      )}

      {access.emailReports ? (
        <div className="panel">
          <h2>Email reports</h2>
          <form action={toggleEmailReports} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input type="hidden" name="on" value={user.emailReports ? 'false' : 'true'} />
            <span className={`badge ${user.emailReports ? 'badge-active' : ''}`}>
              {user.emailReports ? 'on' : 'off'}
            </span>
            <button type="submit" className="btn btn-ghost btn-sm">
              {user.emailReports ? 'Turn off monthly report emails' : 'Turn on monthly report emails'}
            </button>
          </form>
          <p className="muted small" style={{ marginTop: 10 }}>
            One email on the 1st of each month with your finished month&apos;s numbers.
          </p>
        </div>
      ) : null}

      {access.realtime ? (
        <div className="panel">
          <h2>Real-time tracking<span className="hint">live dashboard, updates as you code</span></h2>
          <form action={toggleRealtime} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input type="hidden" name="on" value={user.realtimeEnabled ? 'false' : 'true'} />
            <span className={`badge ${user.realtimeEnabled ? 'badge-active' : ''}`}>
              {user.realtimeEnabled ? 'on' : 'off'}
            </span>
            <button type="submit" className="btn btn-primary btn-sm">
              {user.realtimeEnabled ? 'Turn off real-time' : 'Enable real-time'}
            </button>
          </form>
          {user.realtimeEnabled ? (
            <>
              <p className="muted small" style={{ margin: '12px 0 8px' }}>
                Run this on each machine — it watches your local logs and pushes updates within
                seconds. The dashboard goes live automatically.
              </p>
              <div className="cmd" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <span className="dollar">$</span> lmspend watch --url {appUrl} --key lm_live_…
              </div>
            </>
          ) : (
            <p className="muted small" style={{ marginTop: 10 }}>
              Turn it on, then run <code>lmspend watch</code> on your machine. Aggregates only —
              same privacy as sync.
            </p>
          )}
        </div>
      ) : (
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">Real-time tracking</span>
            <UpgradeCta href="/api/checkout?plan=solo" className="btn btn-primary btn-sm">Unlock — from $19/mo</UpgradeCta>
          </div>
          <p>
            Keep the dashboard live as you code. <code>lmspend watch</code> pushes updates within
            seconds of every turn — no manual sync. Available on Solo and Team.
          </p>
        </div>
      )}

      {access.emailReports ? null : (
        <div className="panel locked">
          <div className="lock-head">
            <span className="lock-title">Monthly email report</span>
            <UpgradeCta href="/api/checkout?plan=solo" className="btn btn-ghost btn-sm">Solo — $19/mo</UpgradeCta>
          </div>
          <p>Your finished month&apos;s numbers in your inbox on the 1st — no need to remember to check.</p>
        </div>
      )}

      <div className="panel">
        <h2>Plan &amp; billing</h2>
        <p style={{ marginBottom: 14 }}>
          <span className={`badge ${badge.className}`}>{badge.label}</span>
        </p>
        {access.plan !== 'free' && user.paidUntil ? (
          <>
            <p className="muted small">
              Access until <strong>{new Date(user.paidUntil).toUTCString().slice(0, 16)}</strong>.
              Each payment adds 31 days — we email you a renewal link 3 days before it runs out.
              No auto-charge, ever.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <UpgradeCta href={`/api/checkout?plan=${user.plan}`} className="btn btn-ghost btn-sm">
                Renew now — +31 days
              </UpgradeCta>
              {access.plan === 'solo' && (
                <UpgradeCta href="/api/checkout?plan=team" className="btn btn-ghost btn-sm">
                  Switch to Team — $49/mo
                </UpgradeCta>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="muted small" style={{ marginBottom: 12 }}>
              {!paymentsEnabled()
                ? <>You currently have complimentary Free access, including sync and current-month
                   reporting. Solo and Team plans will be available when billing launches.</>
                : user.subscriptionStatus === 'expired' || user.subscriptionStatus === 'cancelled'
                  ? <>Your {user.plan} access lapsed — your data is safe, and renewing unlocks it again instantly.</>
                  : <>You&apos;re on the free plan: sync and the current month are yours forever. History,
                     budget alerts, and email reports come with a paid plan.</>}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <UpgradeCta href="/api/checkout?plan=solo" className="btn btn-primary btn-sm">Upgrade to Solo — $19/mo</UpgradeCta>
              <UpgradeCta href="/api/checkout?plan=team" className="btn btn-ghost btn-sm">Upgrade to Team — $49/mo</UpgradeCta>
            </div>
          </>
        )}
        <p className="muted small" style={{ marginTop: 10 }}>
          {paymentsEnabled()
            ? <>Prices in USD. Card payments processed by Kora. No auto-charge — every renewal is your call.</>
            : <>Prices in USD. Billing for Solo and Team will be available at launch. Free access is available now.</>}
        </p>
      </div>

      <div className="panel">
        <h2>Sync a machine</h2>
        <div className="cmd" style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <span className="dollar">$</span> npx lmspend sync --url {appUrl} --key lm_live_…
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Sends aggregates only — costs, token counts, hashed project names. Never code, never
          prompts, never file paths.
        </p>
      </div>
    </main>
  );
}
