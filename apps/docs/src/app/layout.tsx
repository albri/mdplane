import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { HERO_DESCRIPTION, TAGLINE } from '@mdplane/shared';
import './global.css';
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
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
