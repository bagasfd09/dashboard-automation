'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Notifications } from '@/components/Notifications';
import { useWebSocket } from '@/hooks/use-websocket';

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
    }
  });

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketManager />
      {children}
      <Notifications />
    </QueryClientProvider>
  );
}
