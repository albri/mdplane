import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { HERO_DESCRIPTION, TAGLINE } from '@mdplane/shared';
import './global.css';
import { Inter, Space_Grotesk, Space_Mono } from 'next/font/google';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
});

const spaceMono = Space_Mono({
  variable: '--font-space-mono',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | mdplane docs',
    default: `mdplane docs — ${TAGLINE}`,
  },
  description: HERO_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_URL ?? 'https://docs.mdplane.dev'),
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'mdplane docs',
    title: `mdplane docs — ${TAGLINE}`,
    description: HERO_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `mdplane docs — ${TAGLINE}`,
    description: HERO_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <RootProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
          </div>
        </RootProvider>
      </body>
    </html>
  );
}
