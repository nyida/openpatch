import type { Metadata } from 'next';
import { Source_Serif_4, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/Nav';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AppStoreProvider } from '@/context/AppStore';
import { DataFeedBar } from '@/components/whale/DataFeedBar';
import { LiveDataProviders } from '@/components/whale/LiveDataProviders';
import { SpreadModalProvider } from '@/context/SpreadModalContext';
import { AppFooter } from '@/components/AppFooter';

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Algomarket',
  description: 'Cross-venue prediction market analytics — Kalshi & Polymarket',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${sourceSans.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen flex flex-col font-sans antialiased">
        <div className="app-bg" aria-hidden />
        <QueryProvider>
          <AppStoreProvider>
            <SpreadModalProvider>
              <Nav />
              <DataFeedBar />
              <LiveDataProviders />
              <main className="flex-1 w-full relative z-[1]">{children}</main>
              <AppFooter />
            </SpreadModalProvider>
          </AppStoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
