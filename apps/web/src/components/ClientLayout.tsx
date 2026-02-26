'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Providers } from '@/components/providers';
import { useAuth } from '@/providers/AuthProvider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isAuthPage) {
      router.push('/auth/login');
      return;
    }
    if (user?.mustChangePass && pathname !== '/auth/change-password') {
      router.push('/auth/change-password');
    }
  }, [user, isLoading, isAuthPage, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  if (isAuthPage) {
    return (
      <Providers>
        <RouteGuard>
          <main className="flex-1 overflow-auto">{children}</main>
        </RouteGuard>
      </Providers>
    );
  }

  return (
    <Providers>
      <Sidebar />
      <RouteGuard>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </RouteGuard>
    </Providers>
  );
}
