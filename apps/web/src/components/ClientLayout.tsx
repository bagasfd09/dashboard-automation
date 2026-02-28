'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Providers } from '@/components/providers';
import { useAuth } from '@/providers/AuthProvider';
import { NavigationProgress } from '@/components/NavigationProgress';
import { NavigationProgressListener } from '@/components/NavigationProgressListener';

function FullScreenSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// ── Dashboard pages (requires auth) ──────────────────────────────────────────

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (user.mustChangePass && pathname !== '/auth/change-password') {
      router.push('/auth/change-password');
    }
  }, [isLoading, user, pathname, router]);

  // Spinner covers the whole screen — redirect fires from the effect above
  if (isLoading || !user) return <FullScreenSpinner />;
  if (user.mustChangePass) return <FullScreenSpinner />;

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <div key={pathname} className="page-enter">
          {children}
        </div>
      </main>
    </>
  );
}

// ── Auth pages (login, forgot-password, etc.) ────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || !user) return;
    // Already authenticated — send to dashboard (unless they need to change password)
    if (user.mustChangePass) {
      if (pathname !== '/auth/change-password') router.push('/auth/change-password');
    } else {
      if (pathname !== '/auth/change-password') router.push('/');
    }
  }, [isLoading, user, pathname, router]);

  if (isLoading) return <FullScreenSpinner />;

  return <main className="flex-1 overflow-auto">{children}</main>;
}

// ── Root layout ───────────────────────────────────────────────────────────────

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/auth');

  return (
    <Providers>
      <NavigationProgressListener />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {isAuthPage ? (
        <AuthGuard>{children}</AuthGuard>
      ) : (
        <DashboardGuard>{children}</DashboardGuard>
      )}
    </Providers>
  );
}
