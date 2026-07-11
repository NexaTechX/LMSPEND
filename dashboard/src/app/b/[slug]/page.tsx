import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyCommand } from '@/components/copy-command';
import { absoluteUrl, pageMetadata } from '@/lib/seo';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

const usd = (n: number) => `$${n.toFixed(2)}`;

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const share = await getStore().getShare(slug);
  if (!share) {
    return pageMetadata({
      title: 'Share not found',
      description: 'This LMSpend share card could not be found.',
      path: `/b/${slug}`,
      index: false,
    });
  }

  const title = share.roiMultiple !== null
    ? `${usd(share.totalUsd)} of AI coding value — ${share.roiMultiple.toFixed(1)}× plan ROI`
    : `My AI coding bill: ${usd(share.totalUsd)} (${share.month})`;
  const description =
    'See what you actually spend on AI coding tools. Free, local-first CLI — npx lmspend.';
  // Dynamic OG is served by ./opengraph-image; also fall back to brand image.
  const image = absoluteUrl(`/b/${slug}/opengraph-image`);

  return pageMetadata({
    title,
    description,
    path: `/b/${slug}`,
    index: true,
    absoluteTitle: true,
    image,
    imageAlt: title,
  });
}

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await getStore().getShare(slug);
  if (!share) notFound();

  return (
    <main className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 520 }}>
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <p className="muted small" style={{ marginTop: 16 }}>
          {share.roiMultiple !== null ? 'AI coding month' : 'AI coding bill'} — {share.month}
        </p>
        <p style={{ fontSize: 52, fontWeight: 700 }} className="num">{usd(share.totalUsd)}</p>
        {share.roiMultiple !== null && share.planMonthly !== null && (
          <p style={{ color: 'var(--amber-bright)' }}>
            of API-priced value on a ${share.planMonthly.toFixed(0)}/mo plan — {share.roiMultiple.toFixed(1)}× ROI
          </p>
        )}
        <table style={{ margin: '18px 0' }}>
          <tbody>
            {share.topModel && (
              <tr>
                <td className="muted">top model</td>
                <td className="mono">{share.topModel}</td>
                <td className="num">{share.topModelUsd !== null ? usd(share.topModelUsd) : ''}</td>
              </tr>
            )}
            {share.topDay && (
              <tr>
                <td className="muted">most expensive day</td>
                <td className="mono">{share.topDay}</td>
                <td className="num">{share.topDayUsd !== null ? usd(share.topDayUsd) : ''}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="muted small">What&apos;s your number?</p>
        <CopyCommand command="npx lmspend" />
        <p className="muted small" style={{ marginTop: 12 }}>
          Free, open source, local-first — reads the usage logs already on your machine.
        </p>
      </div>
    </main>
  );
}
