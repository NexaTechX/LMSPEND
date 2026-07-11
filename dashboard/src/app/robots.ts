import type { MetadataRoute } from 'next';
import { absoluteUrl, siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const host = siteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/cursor', '/b/'],
        disallow: [
          '/dashboard',
          '/settings',
          '/team',
          '/admin',
          '/api/',
          '/auth/',
          '/login',
          '/join/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host,
  };
}
