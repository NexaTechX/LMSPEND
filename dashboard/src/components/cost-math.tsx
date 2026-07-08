import { explainModel, pricingUpdatedAt } from '@/lib/pricing';
import type { SpendBucket } from '@/lib/store';

const usd = (n: number) => `$${n.toFixed(2)}`;

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * "Show the math" — per-model cost breakdown matching the CLI's `lmspend
 * --explain`. Tools that bill directly (Cursor) are labelled invoice-exact
 * rather than shown as token×rate. Shared by the personal and team views.
 */
export function CostMath({
  data,
  label = 'how each estimate is computed',
}: {
  data: Record<string, SpendBucket>;
  label?: string;
}) {
  const rows = Object.entries(data).sort((a, b) => b[1].cost - a[1].cost).slice(0, 20);
  if (!rows.length) return null;

  return (
    <div className="panel">
      <details className="faq" style={{ margin: 0 }}>
        <summary style={{ fontWeight: 600, fontSize: 15 }}>
          Show the math<span className="hint" style={{ fontWeight: 400 }}>{label}</span>
        </summary>
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          {rows.map(([model, b]) => {
            const m = explainModel(model, b);
            return (
              <div key={model} style={{ marginBottom: 18 }}>
                <div className="mono" style={{ marginBottom: 6 }}>
                  {model}{m.approximate && <span className="muted small"> · ~family rate</span>}
                </div>
                {m.toolReported ? (
                  <p className="muted small">
                    Reported directly by the tool (invoice-exact) — {usd(m.actual)}.
                  </p>
                ) : (
                  <table>
                    <tbody>
                      {m.lines.filter((l) => l.tokens > 0).map((l) => (
                        <tr key={l.label}>
                          <td className="muted small" style={{ width: 110 }}>{l.label}</td>
                          <td className="num muted small">{fmtTokens(l.tokens)}</td>
                          <td className="muted small">× ${l.rate}/M</td>
                          <td className="num" style={{ width: 90 }}>{usd(l.cost)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="small" style={{ fontWeight: 600 }}>subtotal</td>
                        <td /><td />
                        <td className="num" style={{ fontWeight: 600 }}>{usd(m.computed)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          <p className="muted small">
            Estimates at API list prices, pricing table {pricingUpdatedAt}. Verify locally with{' '}
            <code>lmspend --explain</code>. Tools that bill directly (e.g. Cursor) show their exact charge.
          </p>
        </div>
      </details>
    </div>
  );
}
