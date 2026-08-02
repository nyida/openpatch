import type { Metadata } from 'next';
import { Source_Serif_4, Source_Sans_3, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AppStoreProvider } from '@/context/AppStore';
import { SpreadModalProvider } from '@/context/SpreadModalContext';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { AuthModalProvider } from '@/lib/auth/AuthModalContext';
import { AppChrome } from '@/components/auth/AppChrome';

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
  description: 'Cross-venue prediction market analytics - Kalshi & Polymarket',
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
            <AuthProvider>
              <AuthModalProvider>
                <SpreadModalProvider>
                  <AppChrome>{children}</AppChrome>
                </SpreadModalProvider>
              </AuthModalProvider>
            </AuthProvider>
          </AppStoreProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
