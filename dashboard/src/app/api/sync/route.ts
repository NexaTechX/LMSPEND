import { NextRequest, NextResponse } from 'next/server';
import { getStore, topPercentile, type MonthlySpend, type SpendBucket } from '@/lib/store';

const MAX_BODY_BYTES = 512 * 1024;

function isBucket(v: unknown): v is SpendBucket {
  if (typeof v !== 'object' || v === null) return false;
  const b = v as Record<string, unknown>;
  return ['cost', 'inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'events']
    .every((k) => typeof b[k] === 'number' && Number.isFinite(b[k] as number));
}

function isBucketMap(v: unknown): v is Record<string, SpendBucket> {
  return typeof v === 'object' && v !== null && Object.values(v).every(isBucket);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const store = getStore();

  const auth = req.headers.get('authorization') ?? '';
  const key = auth.replace(/^Bearer\s+/i, '');
  const email = key ? await store.emailForApiKey(key) : null;
  if (!email) {
    return NextResponse.json(
      { error: 'invalid or missing API key — create one in the dashboard under Settings' },
      { status: 401 },
    );
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const month = body.month;
  const total = body.estimatedTotalUsd;
  if (
    typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month) ||
    typeof total !== 'number' || !Number.isFinite(total) ||
    !isBucketMap(body.byTool) || !isBucketMap(body.byModel) ||
    !isBucketMap(body.byProject) || !isBucketMap(body.byDay)
  ) {
    return NextResponse.json({ error: 'malformed payload' }, { status: 400 });
  }

  const optNum = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;

  const spend: MonthlySpend = {
    month,
    estimatedTotalUsd: total,
    planMonthly: optNum(body.planMonthly, 100_000),
    roiMultiple: optNum(body.roiMultiple, 10_000),
    byTool: body.byTool,
    byModel: body.byModel,
    byProject: body.byProject,
    byDay: body.byDay,
    syncedAt: new Date().toISOString(),
  };
  await store.upsertSpend(email, spend);

  const totals = await store.getMonthTotals(month);
  const percentile = totals.length > 1 ? topPercentile(totals, total) : undefined;

  return NextResponse.json({ ok: true, month, user: email, percentile });
}
