import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { currentUserEmail } from '@/lib/auth';
import { getStore, type SpendBucket } from '@/lib/store';

export const runtime = 'nodejs';

const usd = (n: number) => `$${n.toFixed(2)}`;

function topOf(data: Record<string, SpendBucket>): [string, number] | null {
  const rows = Object.entries(data).sort((a, b) => b[1].cost - a[1].cost);
  return rows.length ? [rows[0][0], rows[0][1].cost] : null;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const names = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[(m || 1) - 1]} ${y}`;
}

/**
 * On-the-fly branded PNG for the signed-in user's month. Watermarked with the
 * lmspend wordmark + install command so every shared card promotes us.
 * No plan gate — sharing is top-of-funnel, we want everyone doing it.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const email = await currentUserEmail();
  if (!email) return new Response('Sign in to download your card.', { status: 401 });

  const months = await getStore().getSpend(email);
  const wanted = req.nextUrl.searchParams.get('month');
  const cur = (wanted ? months.find((m) => m.month === wanted) : months[0]) ?? months[0];
  if (!cur) return new Response('No spend synced yet.', { status: 404 });

  const roi = cur.roiMultiple ?? null;
  const plan = cur.planMonthly ?? null;
  const topModel = topOf(cur.byModel);
  const topDay = topOf(cur.byDay);
  const headline = roi !== null ? 'My AI coding month' : 'My AI coding bill';
  const sub = roi !== null && plan
    ? `${usd(cur.estimatedTotalUsd)} of API-priced value on a $${plan.toFixed(0)}/mo plan — ${roi.toFixed(1)}× ROI`
    : topModel
      ? `top model: ${topModel[0]} · ${usd(topModel[1])}`
      : 'estimated at API list prices';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#0a0c10',
          color: '#e9eef5',
          fontFamily: 'monospace',
        }}
      >
        {/* header: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700 }}>
          <span>lmspend</span>
          <span style={{ color: '#e8b45a' }}>_</span>
          <span style={{ marginLeft: 20, color: '#5c6b80', fontSize: 24, fontWeight: 400 }}>
            {headline} — {monthLabel(cur.month)}
          </span>
        </div>

        {/* big number */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 700, lineHeight: 1 }}>
            {usd(cur.estimatedTotalUsd)}
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#e8b45a', marginTop: 18, maxWidth: 1050 }}>
            {sub}
          </div>
          {topDay && (
            <div style={{ display: 'flex', fontSize: 24, color: '#8fa0b5', marginTop: 12 }}>
              most expensive day: {topDay[0]} ({usd(topDay[1])})
            </div>
          )}
        </div>

        {/* footer watermark: promotion */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', color: '#5c6b80', fontSize: 24 }}>
            estimates at API list prices
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#1a1204',
              backgroundColor: '#e8b45a',
              padding: '10px 22px',
              borderRadius: 8,
            }}
          >
            track yours → npx lmspend
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'content-disposition': `attachment; filename="lmspend-${cur.month}.png"`,
        'cache-control': 'no-store',
      },
    },
  );
}
