import { NextRequest, NextResponse } from 'next/server';
import { currentUserEmail } from '@/lib/auth';
import { can } from '@/lib/plan';
import { getStore, type SpendBucket } from '@/lib/store';

/** CSV expense export (paid) — one file finance will actually accept. */

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rows(section: string, data: Record<string, SpendBucket>): string[] {
  return Object.entries(data)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([name, b]) =>
      [section, csvEscape(name), b.cost.toFixed(4), b.inputTokens, b.outputTokens,
        b.cacheReadTokens, b.cacheWriteTokens, b.events].join(','),
    );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const email = await currentUserEmail();
  if (!email) return NextResponse.json({ error: 'sign in first' }, { status: 401 });

  const store = getStore();
  const user = await store.ensureUser(email);
  if (!can(user).history) {
    return NextResponse.json(
      { error: 'CSV export is a paid feature — upgrade at /settings' },
      { status: 402 },
    );
  }

  const month = req.nextUrl.searchParams.get('month');
  const months = await store.getSpend(email);
  const target = month ? months.find((m) => m.month === month) : months[0];
  if (!target) return NextResponse.json({ error: 'no data for that month' }, { status: 404 });

  const lines = [
    'section,name,estimated_cost_usd,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,events',
    ...rows('tool', target.byTool),
    ...rows('model', target.byModel),
    ...rows('project_hashed', target.byProject),
    ...rows('day', target.byDay),
    `total,${target.month},${target.estimatedTotalUsd.toFixed(4)},,,,,`,
  ];

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="lmspend-${target.month}.csv"`,
    },
  });
}
