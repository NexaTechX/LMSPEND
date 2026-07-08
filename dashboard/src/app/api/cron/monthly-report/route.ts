import { NextRequest, NextResponse } from 'next/server';
import { monthlyReportHtml, sendEmail } from '@/lib/email';
import { isPaid } from '@/lib/plan';
import { getStore } from '@/lib/store';

/**
 * Monthly cron (run on the 1st): emails every opted-in user their finished
 * month's report — the retention + re-share loop.
 */

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const store = getStore();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonth = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 1, 1));
  const prevMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;

  let sent = 0;
  for (const user of await store.listUsers()) {
    if (!user.emailReports || !isPaid(user)) continue;
    const months = await store.getSpend(user.email);
    const report = months.find((m) => m.month === lastMonth);
    if (!report) continue;

    const prevReport = months.find((m) => m.month === prevMonth);
    const topModel = Object.entries(report.byModel)
      .sort((a, b) => b[1].cost - a[1].cost)[0]?.[0] ?? null;

    if (await sendEmail(
      user.email,
      `Your ${lastMonth} AI coding spend: $${report.estimatedTotalUsd.toFixed(2)}`,
      monthlyReportHtml(lastMonth, report.estimatedTotalUsd, prevReport?.estimatedTotalUsd ?? null, topModel, appUrl),
    )) sent++;
  }

  return NextResponse.json({ ok: true, month: lastMonth, sent });
}
