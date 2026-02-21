import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useRuns(page = 1, teamId?: string) {
  return useQuery({
    queryKey: ['runs', page, teamId],
    queryFn: () => api.getRuns({ page, limit: 10, teamId }),
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: ['run', id],
    queryFn: () => api.getRun(id),
    enabled: !!id,
  });
}
