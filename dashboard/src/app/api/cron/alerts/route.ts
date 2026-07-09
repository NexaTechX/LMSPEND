import { NextRequest, NextResponse } from 'next/server';
import { resolveAppUrl } from '@/lib/app-url';
import { budgetAlertHtml, deltaAlertHtml, postSlack, renewalReminderHtml, sendEmail } from '@/lib/email';
import { isPaid } from '@/lib/plan';
import { getStore } from '@/lib/store';

/**
 * Daily cron: budget alerts, unusual-day alerts, renewal reminders, expiry.
 * Schedule with Vercel Cron (vercel.json) or any scheduler hitting this URL.
 * Secured by CRON_SECRET (open in dev when unset).
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const store = getStore();
  const appUrl = resolveAppUrl();
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const results = { budgetAlerts: 0, deltaAlerts: 0, renewalReminders: 0, expired: 0 };

  for (const user of await store.listUsers()) {
    const months = await store.getSpend(user.email);
    const current = months.find((m) => m.month === month);

    // Budget + unusual-day alerts (paid feature) — email and, if set, Slack.
    if (current && isPaid(user)) {
      const budget = await store.getBudget(user.email);
      const slack = await store.getSlackWebhook(user.email);
      if (budget !== null && current.estimatedTotalUsd > budget) {
        if (await sendEmail(
          user.email,
          `Budget alert: ${month} spend is $${current.estimatedTotalUsd.toFixed(0)} (limit $${budget.toFixed(0)})`,
          budgetAlertHtml(month, current.estimatedTotalUsd, budget, appUrl),
        )) results.budgetAlerts++;
        if (slack) {
          await postSlack(slack,
            `:moneybag: *lmspend budget alert* — ${month} AI coding spend is $${current.estimatedTotalUsd.toFixed(2)}, past the $${budget.toFixed(0)} budget. ${appUrl}/dashboard`);
        }
      }

      // Unusual day: yesterday ≥ 3× the daily average of the month so far.
      const days = Object.entries(current.byDay).sort((a, b) => a[0].localeCompare(b[0]));
      if (days.length >= 3) {
        const y = new Date(now);
        y.setUTCDate(y.getUTCDate() - 1);
        const yKey = y.toISOString().slice(0, 10);
        const yesterday = current.byDay[yKey];
        const others = days.filter(([d]) => d !== yKey);
        const avg = others.reduce((s, [, b]) => s + b.cost, 0) / others.length;
        if (yesterday && avg > 0.5 && yesterday.cost >= avg * 3) {
          if (await sendEmail(
            user.email,
            `Unusual spend: ${yKey} was ${(yesterday.cost / avg).toFixed(1)}× your average`,
            deltaAlertHtml(yKey, yesterday.cost, avg, appUrl),
          )) results.deltaAlerts++;
          if (slack) {
            await postSlack(slack,
              `:rotating_light: *lmspend unusual spend* — ${yKey} cost $${yesterday.cost.toFixed(2)}, ${(yesterday.cost / avg).toFixed(1)}× the daily average. Probably a long agentic session. ${appUrl}/dashboard`);
          }
        }
      }
    }

    // Renewal + expiry (Kora has no auto-renew — access is 31 days per charge).
    if (user.subscriptionStatus === 'active' && user.paidUntil) {
      const paidUntil = new Date(user.paidUntil);
      const daysLeft = (paidUntil.getTime() - now.getTime()) / 86_400_000;
      if (daysLeft < 0) {
        await store.setSubscription(user.email, user.plan, 'expired');
        results.expired++;
      } else if (daysLeft <= 3) {
        if (await sendEmail(
          user.email,
          `Your LMSpend ${user.plan} plan renews in ${Math.max(1, Math.ceil(daysLeft))} day(s)`,
          renewalReminderHtml(user.plan, user.paidUntil, appUrl),
        )) results.renewalReminders++;
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
