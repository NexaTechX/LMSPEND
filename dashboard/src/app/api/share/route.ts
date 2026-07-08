import { NextRequest, NextResponse } from 'next/server';
import { getStore, type ShareCardData } from '@/lib/store';

/**
 * Anonymous share-card publish from the CLI. Aggregate numbers only — no
 * account, no email, nothing identifying. Every card links back to us.
 */

function num(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function str(v: unknown, maxLen: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen ? v : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const month = str(body.month, 7);
  const totalUsd = num(body.totalUsd, 0, 1_000_000);
  if (!month || !/^\d{4}-\d{2}$/.test(month) || totalUsd === null) {
    return NextResponse.json({ error: 'month (YYYY-MM) and totalUsd required' }, { status: 400 });
  }

  const data: ShareCardData = {
    month,
    totalUsd,
    topModel: str(body.topModel, 60),
    topModelUsd: num(body.topModelUsd, 0, 1_000_000),
    topDay: str(body.topDay, 10),
    topDayUsd: num(body.topDayUsd, 0, 1_000_000),
    planMonthly: num(body.planMonthly, 0, 100_000),
    roiMultiple: num(body.roiMultiple, 0, 10_000),
  };

  const slug = await getStore().createShare(data);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return NextResponse.json({ ok: true, slug, url: `${appUrl}/b/${slug}` });
}
