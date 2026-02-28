import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchForPath } from '@/lib/prefetch-config';

export function usePrefetch(ctx?: { applicationId?: string; teamId?: string }) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetch = useCallback(
    (path: string) => {
      if (prefetchedRef.current.has(path)) return;
      prefetchForPath(queryClient, path, ctx);
      prefetchedRef.current.add(path);
      // Re-allow prefetch after the stale window
      setTimeout(() => prefetchedRef.current.delete(path), 30_000);
    },
    [queryClient, ctx],
  );

  return { prefetch };
}
