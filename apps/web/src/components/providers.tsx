'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Notifications } from '@/components/Notifications';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/lib/api';

function WebSocketManager() {
  const queryClient = useQueryClient();

  useWebSocket((event, data) => {
    const d = (data ?? {}) as Record<string, unknown>;
    const teamName = (d.teamName as string | undefined) ?? '';
    const teamPrefix = teamName ? `[${teamName}] ` : '';

    switch (event) {
      case 'run:started': {
        queryClient.invalidateQueries({ queryKey: ['runs'] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        toast.info(`${teamPrefix}New run started`);
        break;
      }

      case 'run:finished': {
        const runId = (d.id ?? d.runId) as string | undefined;
        const passed = (d.passed as number | undefined) ?? 0;
        const total = (d.totalTests as number | undefined) ?? 0;
        queryClient.invalidateQueries({ queryKey: ['runs'] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        if (runId) queryClient.invalidateQueries({ queryKey: ['run', runId] });
        toast.success(`${teamPrefix}Run finished: ${passed}/${total} passed`);
        break;
      }

      case 'result:new': {
        const runId = d.testRunId as string | undefined;
        if (runId) queryClient.invalidateQueries({ queryKey: ['run', runId] });
        break;
      }

      case 'result:failed': {
        const runId = d.testRunId as string | undefined;
        const testCase = d.testCase as { title?: string } | undefined;
        const title = (d.title ?? testCase?.title ?? 'Unknown test') as string;
        toast.error(`${teamPrefix}Test failed: ${title}`);
        if (runId) queryClient.invalidateQueries({ queryKey: ['run', runId] });
        break;
      }

      case 'artifact:new': {
        const runId = d.testRunId as string | undefined;
        if (runId) queryClient.invalidateQueries({ queryKey: ['run', runId] });
        break;
      }

      case 'retry:requested': {
        queryClient.invalidateQueries({ queryKey: ['retries'] });
        const testTitle = (d.title ?? d.testCaseId ?? 'test') as string;
        toast.info(`${teamPrefix}Retry queued: ${testTitle}`);
        break;
      }
    }
  });

  return null;
}

function CacheWarmer() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    void Promise.allSettled([
      queryClient.prefetchQuery({ queryKey: ['overview', undefined], queryFn: () => api.getOverview(), staleTime: 30_000 }),
      queryClient.prefetchQuery({ queryKey: ['runs', 1, 20, undefined, undefined, undefined, undefined, undefined], queryFn: () => api.getRuns({ page: 1, pageSize: 20 }), staleTime: 15_000 }),
      queryClient.prefetchQuery({ queryKey: ['test-cases-grouped', 'suite', {}, 1, 10, 5], queryFn: () => api.getTestCasesGrouped({ groupBy: 'suite', page: 1, pageSize: 10, innerPageSize: 5 }), staleTime: 30_000 }),
      queryClient.prefetchQuery({ queryKey: ['library-collections', undefined], queryFn: () => api.getCollections(), staleTime: 120_000 }),
    ]);
  }, [isAuthenticated, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,            // 30s before background refetch
            gcTime: 5 * 60_000,          // keep cache 5 min after unmount
            refetchOnWindowFocus: false,  // don't refetch on tab switch
            refetchOnReconnect: true,
            retry: 1,
            retryDelay: 1_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketManager />
      <CacheWarmer />
      {children}
      <Notifications />
    </QueryClientProvider>
  );
}
