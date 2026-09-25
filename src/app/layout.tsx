import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { getLocale } from "gt-next/server";
import { GTProvider } from "gt-next";

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900']
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700']
});

const SITE_DESCRIPTION = 'A city builder set in Varanasi. Plan a living city on the Ganga: ghats, bazaars, monsoon floods, festivals and a river that depends on you.';

/** Public URL for absolute Open Graph links: NEXT_PUBLIC_SITE_URL, else the Vercel URL, else localhost. */
function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return new URL(explicit ?? (vercel ? `https://${vercel}` : 'http://localhost:3000'));
}

// S5-T12: the Open Graph / Twitter image comes from src/app/opengraph-image.tsx (Varanasi riverfront).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: 'Varanasi — City on the Ganga',
    template: 'Varanasi — %s',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Varanasi',
  keywords: ['Varanasi', 'Ganga', 'city builder', 'isometric', 'ghats', 'browser game'],
  openGraph: {
    title: 'Varanasi — City on the Ganga',
    description: SITE_DESCRIPTION,
    type: 'website',
    siteName: 'Varanasi',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Varanasi — City on the Ganga',
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Varanasi'
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1219'
};

export default async function RootLayout({ children }: {children: React.ReactNode;}) {
  return (
  <html className={`dark ${playfair.variable} ${dmSans.variable}`} lang={await getLocale()} suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/assets/buildings/residential.png" />
        {/* Preload critical game assets - WebP for browsers that support it */}
        <link
        rel="preload"
        href="/assets/sprites_red_water_new.webp"
        as="image"
        type="image/webp" />

        <link
        rel="preload"
        href="/assets/water.webp"
        as="image"
        type="image/webp" />

      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden" suppressHydrationWarning><GTProvider>{children}<Analytics /></GTProvider></body>
    </html>
  );
}