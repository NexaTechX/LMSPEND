import { ImageResponse } from 'next/og';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getStore().getShare(slug);

  const total = share ? usd(share.totalUsd) : 'npx lmspend';
  const sub = share
    ? share.roiMultiple !== null && share.planMonthly !== null
      ? `of API-priced value on a $${share.planMonthly.toFixed(0)}/mo plan — ${share.roiMultiple.toFixed(1)}x ROI`
      : `AI coding bill — ${share.month}${share.topModel ? ` · top model: ${share.topModel}` : ''}`
    : 'see what you actually spend on AI coding tools';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 80,
          backgroundColor: '#0a0c10',
          color: '#e9eef5',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#8fa0b5', marginBottom: 24 }}>
          {share ? `My AI coding ${share.roiMultiple !== null ? 'month' : 'bill'} — ${share.month}` : 'lmspend'}
        </div>
        <div style={{ display: 'flex', fontSize: 130, fontWeight: 700, color: '#e9eef5' }}>
          {total}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#e8b45a', marginTop: 18, maxWidth: 1000 }}>
          {sub}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 90,
            fontSize: 28,
          }}
        >
          <div style={{ display: 'flex', color: '#5c6b80' }}>estimates at API list prices</div>
          <div style={{ display: 'flex', color: '#e8b45a', fontWeight: 700 }}>npx lmspend</div>
        </div>
      </div>
    ),
    size,
  );
}
