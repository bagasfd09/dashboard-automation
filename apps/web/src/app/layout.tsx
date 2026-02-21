import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'QC Monitor',
  description: 'Test quality monitoring dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-50 flex h-screen overflow-hidden">
        <Sidebar />
        <Providers>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
