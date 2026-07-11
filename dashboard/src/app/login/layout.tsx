import type { Metadata } from 'next';
import { noIndexRobots } from '@/lib/seo';

export const metadata: Metadata = {
  robots: noIndexRobots,
  title: 'Sign in',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
