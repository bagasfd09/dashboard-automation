import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRuns(page = 1, pageSize = 20, teamId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['runs', page, pageSize, teamId],
    queryFn: () => api.getRuns({ page, pageSize, teamId }),
  });

  function prefetchNext() {
    if (!query.data) return;
    const { totalPages } = query.data.pagination;
    if (page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: ['runs', page + 1, pageSize, teamId],
        queryFn: () => api.getRuns({ page: page + 1, pageSize, teamId }),
      });
    }
  }

  return { ...query, prefetchNext };
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => api.getRun(id),
    enabled: !!id,
  });
}
