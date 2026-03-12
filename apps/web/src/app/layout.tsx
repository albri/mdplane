import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import { Providers } from "@/providers";
import { APP_NAME, HERO_DESCRIPTION, TAGLINE } from "@mdplane/shared";
import { webEnv } from "@/config/env";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_NAME}`,
    default: `${APP_NAME} — ${TAGLINE}`,
  },
  description: HERO_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ['AI agents', 'filesystem', 'coordination', 'markdown', 'collaboration', 'API'],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  metadataBase: new URL(webEnv.appUrl),
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — ${TAGLINE}`,
    description: HERO_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${TAGLINE}`,
    description: HERO_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable} root font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
