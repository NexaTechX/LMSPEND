import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { JsonLd } from '@/components/json-ld';
import { SITE, absoluteUrl, ogImageUrl, siteUrl } from '@/lib/seo';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: SITE.themeColor },
    { media: '(prefers-color-scheme: light)', color: SITE.themeColor },
  ],
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.applicationName,
  authors: [{ name: SITE.author, url: absoluteUrl('/') }],
  creator: SITE.creator,
  publisher: SITE.publisher,
  category: SITE.category,
  keywords: [...SITE.keywords],
  referrer: 'origin-when-cross-origin',
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: absoluteUrl('/'),
    languages: { en: absoluteUrl('/') },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: SITE.locale,
    url: absoluteUrl('/'),
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [
      {
        url: ogImageUrl(),
        width: SITE.ogImageWidth,
        height: SITE.ogImageHeight,
        type: 'image/png',
        alt: SITE.ogImageAlt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [ogImageUrl()],
    ...(SITE.twitter ? { site: SITE.twitter, creator: SITE.twitter } : {}),
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'black-translucent',
  },
  other: {
    'msapplication-TileColor': SITE.themeColor,
  },
};

function rootJsonLd() {
  const url = absoluteUrl('/');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: SITE.name,
        url,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/apple-icon'),
        },
        description: SITE.description,
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: SITE.name,
        url,
        description: SITE.description,
        publisher: { '@id': `${url}/#organization` },
        inLanguage: SITE.language,
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}/#app`,
        name: SITE.name,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Windows, macOS, Linux',
        url,
        description: SITE.description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free CLI and free-tier dashboard sync',
        },
        publisher: { '@id': `${url}/#organization` },
      },
    ],
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.language} className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <JsonLd data={rootJsonLd()} />
        {children}
      </body>
    </html>
  );
}
