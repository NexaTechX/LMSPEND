import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** Favicon — amber underscore cursor on ink. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0c10',
          color: '#e8b45a',
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'monospace',
        }}
      >
        _
      </div>
    ),
    size,
  );
}
