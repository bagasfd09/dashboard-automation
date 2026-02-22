import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRetries(page = 1, pageSize = 20, teamId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['retries', page, pageSize, teamId],
    queryFn: () => api.getRetries({ page, pageSize, teamId }),
    refetchInterval: 10_000,
  });

  function prefetchNext() {
    if (!query.data) return;
    const { totalPages } = query.data.pagination;
    if (page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: ['retries', page + 1, pageSize, teamId],
        queryFn: () => api.getRetries({ page: page + 1, pageSize, teamId }),
      });
    }
  }

  return { ...query, prefetchNext };
}
