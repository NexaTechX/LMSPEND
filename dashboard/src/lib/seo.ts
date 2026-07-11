import type { Metadata } from 'next';
import { resolveAppUrl } from './app-url';

/** Canonical production host — used when env is unset at build time. */
export const SITE_URL_FALLBACK = 'https://lmspend.vercel.app';

export const SITE = {
  name: 'LMSpend',
  shortName: 'lmspend',
  applicationName: 'LMSpend',
  tagline: 'Know what you actually spend on AI coding tools',
  description:
    'One dashboard for Claude Code, Cursor, and Codex spend. Free open-source CLI, local-first — no proxy, your code never leaves the machine.',
  locale: 'en_US',
  language: 'en',
  category: 'technology',
  author: 'LMSpend',
  creator: 'LMSpend',
  publisher: 'LMSpend',
  keywords: [
    'AI coding spend',
    'Claude Code cost',
    'Cursor usage',
    'Codex billing',
    'AI developer tools cost',
    'team AI budget',
    'local-first CLI',
  ],
  /** Set NEXT_PUBLIC_TWITTER_HANDLE (e.g. @lmspend) when the account exists. */
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE?.trim() || undefined,
  /** Cache-bust so X/IG refetch after deploy. Prefer JPEG — more reliable for crawlers. */
  ogImagePath: '/og-image.jpg',
  ogImageAlt: 'LMSpend — know what you spend on AI coding tools',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: 'image/jpeg',
  themeColor: '#0a0c10',
} as const;

export function siteUrl(): string {
  try {
    return resolveAppUrl() || SITE_URL_FALLBACK;
  } catch {
    return SITE_URL_FALLBACK;
  }
}

export function absoluteUrl(path = '/'): string {
  const base = siteUrl().replace(/\/+$/, '');
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function ogImageUrl(): string {
  return absoluteUrl(SITE.ogImagePath);
}

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

export const indexRobots = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large' as const,
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

type PageSeoInput = {
  title: string;
  description: string;
  path: string;
  /** When false, page is excluded from search indexes. Default true. */
  index?: boolean;
  keywords?: string[];
  ogType?: 'website' | 'article' | 'profile';
  /** Absolute image URL override (defaults to brand OG image). */
  image?: string;
  imageAlt?: string;
  /** Skip the root title template (use for the homepage). */
  absoluteTitle?: boolean;
};

/** Build unique Metadata for a public (or private) page — no duplicated OG/Twitter boilerplate. */
export function pageMetadata({
  title,
  description,
  path,
  index = true,
  keywords,
  ogType = 'website',
  image,
  imageAlt,
  absoluteTitle = false,
}: PageSeoInput): Metadata {
  const url = absoluteUrl(path);
  const img = image ?? ogImageUrl();
  const alt = imageAlt ?? SITE.ogImageAlt;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: keywords ?? [...SITE.keywords],
    alternates: { canonical: url },
    robots: index ? indexRobots : noIndexRobots,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: ogType,
      images: [
        {
          url: img,
          secureUrl: img.startsWith('https') ? img : undefined,
          width: SITE.ogImageWidth,
          height: SITE.ogImageHeight,
          type: SITE.ogImageType,
          alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [img],
      ...(SITE.twitter ? { site: SITE.twitter, creator: SITE.twitter } : {}),
    },
  };
}

/** Shared noindex metadata for authenticated / auth-flow surfaces. */
export function privatePageMetadata(title: string, description?: string, path = '/'): Metadata {
  return pageMetadata({
    title,
    description: description ?? `${title} — ${SITE.name}`,
    path,
    index: false,
  });
}
