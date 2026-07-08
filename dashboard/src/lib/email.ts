/**
 * Email via Resend's HTTP API (no SDK dependency). Without RESEND_API_KEY the
 * send is logged and skipped — dev mode stays zero-config.
 */

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'LMSpend <reports@lmspend.example.com>';

  if (!apiKey) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return false;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    console.error(`email send failed (${res.status}): ${await res.text()}`);
    return false;
  }
  return true;
}

const wrap = (inner: string) => `
<div style="font-family:ui-monospace,Consolas,monospace;background:#0a0c10;color:#e9eef5;padding:32px;border-radius:12px;max-width:560px;margin:0 auto">
  ${inner}
  <p style="color:#5c6b80;font-size:12px;margin-top:28px">lmspend — estimates at API list prices. You can turn these emails off in Settings.</p>
</div>`;

const usd = (n: number) => `$${n.toFixed(2)}`;

/** Post a plain-text alert to a Slack incoming webhook. Never throws. */
export async function postSlack(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function budgetAlertHtml(month: string, spent: number, limit: number, appUrl: string): string {
  return wrap(`
  <h2 style="color:#e8b45a;margin:0 0 12px">Budget alert</h2>
  <p>Your AI coding spend for ${month} is <strong>${usd(spent)}</strong> — past your ${usd(limit)} budget.</p>
  <p><a href="${appUrl}/dashboard" style="color:#e8b45a">See the breakdown →</a></p>`);
}

export function deltaAlertHtml(day: string, dayCost: number, avg: number, appUrl: string): string {
  return wrap(`
  <h2 style="color:#e8b45a;margin:0 0 12px">Unusual spend</h2>
  <p><strong>${day}</strong> cost <strong>${usd(dayCost)}</strong> — ${(dayCost / Math.max(avg, 0.01)).toFixed(1)}× your daily average of ${usd(avg)}.</p>
  <p>Probably a long agentic session. Worth a look if it wasn't you.</p>
  <p><a href="${appUrl}/dashboard" style="color:#e8b45a">See the breakdown →</a></p>`);
}

export function monthlyReportHtml(
  month: string,
  total: number,
  prevTotal: number | null,
  topModel: string | null,
  appUrl: string,
): string {
  const delta = prevTotal && prevTotal > 0
    ? ` (${total >= prevTotal ? '+' : ''}${(((total - prevTotal) / prevTotal) * 100).toFixed(0)}% vs ${'last month'})`
    : '';
  return wrap(`
  <h2 style="color:#e8b45a;margin:0 0 12px">Your ${month} AI coding report</h2>
  <p style="font-size:28px;font-weight:700;margin:8px 0">${usd(total)}<span style="font-size:13px;color:#8fa0b5;font-weight:400">${delta}</span></p>
  ${topModel ? `<p>Top model: <strong>${topModel}</strong></p>` : ''}
  <p><a href="${appUrl}/dashboard" style="color:#e8b45a">Full breakdown →</a> · share it: <code>lmspend share</code></p>`);
}

export function renewalReminderHtml(plan: string, paidUntil: string, appUrl: string): string {
  return wrap(`
  <h2 style="color:#e8b45a;margin:0 0 12px">Your ${plan} plan renews soon</h2>
  <p>Access runs until <strong>${new Date(paidUntil).toUTCString().slice(0, 16)}</strong>.</p>
  <p>Renew in one click to keep history, budgets, and alerts running:</p>
  <p><a href="${appUrl}/api/checkout?plan=${plan}" style="color:#1a1204;background:#e8b45a;padding:10px 18px;border-radius:6px;font-weight:700;text-decoration:none">Renew ${plan} →</a></p>`);
}
