import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/seo';

export const alt = SITE.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default Open Graph / Twitter card — matches brand (ink + amber phosphor). */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 72,
          backgroundColor: '#0a0c10',
          color: '#e9eef5',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 600, marginBottom: 28 }}>
          <span style={{ color: '#e9eef5' }}>lmspend</span>
          <span style={{ color: '#e8b45a' }}>_</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 980,
            letterSpacing: '-0.02em',
          }}
        >
          Know what you spend on AI coding tools.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#8fa0b5',
            marginTop: 28,
            maxWidth: 900,
          }}
        >
          Claude Code · Cursor · Codex — one dashboard. Free CLI, local-first.
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 56,
            fontSize: 24,
            color: '#e8b45a',
            fontWeight: 700,
          }}
        >
          npx lmspend
        </div>
      </div>
    ),
    size,
  );
}
