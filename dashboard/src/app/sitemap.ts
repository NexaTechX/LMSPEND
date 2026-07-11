import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

/** Indexable marketing / docs URLs only — never auth, app, or invite tokens. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/cursor'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
