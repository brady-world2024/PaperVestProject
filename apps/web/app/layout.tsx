import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';

import { webThemeVariables } from '@papervest/design-tokens';

import './globals.css';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: 'PaperVest',
  description: 'Paper trading for US stocks across mobile and web using one backend contract.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  icons: {
    icon: '/brand/papervest-logo.png',
    shortcut: '/brand/papervest-logo.png',
    apple: '/brand/papervest-logo.png',
  },
  openGraph: {
    title: 'PaperVest',
    description: 'Paper trading for US stocks across mobile and web using one backend contract.',
    images: [
      {
        url: '/brand/papervest-logo.png',
        width: 768,
        height: 768,
        alt: 'PaperVest logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PaperVest',
    description: 'Paper trading for US stocks across mobile and web using one backend contract.',
    images: ['/brand/papervest-logo.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={webThemeVariables as CSSProperties}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
