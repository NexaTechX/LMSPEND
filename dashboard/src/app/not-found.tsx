import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Page not found',
  description: 'That page does not exist. Head back to LMSpend — AI coding spend tracking.',
  path: '/',
  index: false,
});

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="wordmark">lmspend<span className="cursor">_</span></Link>
        <h1>Page not found</h1>
        <p className="muted">That URL doesn&apos;t exist — or it moved.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
          <Link href="/" className="btn btn-primary">Home</Link>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
