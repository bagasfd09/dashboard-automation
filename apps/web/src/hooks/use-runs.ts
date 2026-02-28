import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface RunsFilters {
  page?: number;
  pageSize?: number;
  teamId?: string;
  source?: string;
  branch?: string;
  environment?: string;
  applicationId?: string;
}

export function useRuns(filters: RunsFilters = {}) {
  const { page = 1, pageSize = 20, teamId, source, branch, environment, applicationId } = filters;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['runs', page, pageSize, teamId, source, branch, environment, applicationId],
    queryFn: () => api.getRuns({ page, pageSize, teamId, source, branch, environment, applicationId }),
    staleTime: 15_000,
  });

  function prefetchNext() {
    if (!query.data) return;
    const { totalPages } = query.data.pagination;
    if (page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: ['runs', page + 1, pageSize, teamId, source, branch, environment, applicationId],
        queryFn: () => api.getRuns({ page: page + 1, pageSize, teamId, source, branch, environment, applicationId }),
      });
    }
  }

  return { ...query, prefetchNext };
}

export function useRun(
  id: string,
  params?: { page?: number; pageSize?: number; status?: string; search?: string },
) {
  return useQuery({
    queryKey: ['run', id, params],
    queryFn: () => api.getRun(id, params),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useRunResultsGrouped(
  id: string,
  params?: { page?: number; pageSize?: number; innerPageSize?: number; status?: string },
) {
  return useQuery({
    queryKey: ['run-results-grouped', id, params],
    queryFn: () => api.getRunResultsGrouped(id, params),
    enabled: !!id,
    staleTime: 10_000,
  });
}
