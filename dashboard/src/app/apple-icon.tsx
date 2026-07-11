import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0c10',
          color: '#e9eef5',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, color: '#8fa0b5', marginBottom: 8 }}>lmspend</div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, color: '#e8b45a' }}>_</div>
      </div>
    ),
    size,
  );
}
