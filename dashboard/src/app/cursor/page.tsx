import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
  title: 'Connect Cursor',
  description:
    'Connect Cursor to LMSpend with the Team Admin API — invoice-exact spend, no estimation. Two-minute setup.',
  path: '/cursor',
  keywords: ['Cursor Admin API', 'Cursor spend tracking', 'LMSpend Cursor setup'],
});

export default function CursorSetup() {
  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Connect Cursor</h1>
        <div className="notice notice-ok" style={{ marginTop: 14 }}>
          Cursor is supported. It uses Cursor&apos;s official Team Admin API, so the numbers match
          your invoice exactly — no estimation.
        </div>
        <p className="muted">Two steps, one minute:</p>

        <div className="onboarding" style={{ marginTop: 8 }}>
          <div className="step-row">
            <span className="step-num">1</span>
            <div>
              <strong>Get an Admin API key</strong>
              <p className="muted small">
                In Cursor → Dashboard → Settings → Admin API keys (team admins only). Copy the
                key that starts with <code>key_</code>.
              </p>
            </div>
          </div>
          <div className="step-row">
            <span className="step-num">2</span>
            <div style={{ width: '100%' }}>
              <strong>Add it to <code>~/.lmspend.json</code></strong>
              <pre className="block" style={{ marginTop: 8, whiteSpace: 'pre', overflowX: 'auto', fontFamily: 'var(--mono)' }}>{`{
  "cursor": {
    "adminApiKey": "key_xxx",
    "email": "you@company.com"
  }
}`}</pre>
              <p className="muted small">
                The <code>email</code> filters to your own usage so a teammate&apos;s sync
                doesn&apos;t double-count. Omit it to pull the whole team&apos;s Cursor spend.
              </p>
            </div>
          </div>
        </div>

        <p className="muted small" style={{ marginTop: 8 }}>
          Then run <code>lmspend doctor</code> to confirm it&apos;s connected, or{' '}
          <code>lmspend report</code> to see Cursor in your totals.
        </p>
      </div>
    </main>
  );
}
