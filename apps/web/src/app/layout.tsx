import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'Fleet Pulse | Dispatcher Dashboard',
  description: 'Real-time delivery dispatch platform dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-slate-950 text-slate-50 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
