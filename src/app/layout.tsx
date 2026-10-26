import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sorelle — Pilihan Hangat untuk Rumah',
  description: 'Ruang belanja kurasi hangat untuk rumah, gaya hidup, dan artisan lokal.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Sorelle' },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, themeColor: '#fff8f5',
};

const isProduction = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true';
const snapUrl = isProduction
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';
const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        {clientKey ? (
          <Script
            src={snapUrl}
            data-client-key={clientKey}
            strategy="afterInteractive"
          />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
