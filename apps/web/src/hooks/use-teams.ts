import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(),
    staleTime: 300_000,
  });
}

export function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ['team-stats', teamId],
    queryFn: () => api.getTeamStats(teamId),
    enabled: !!teamId,
  });
}

export function useOverview(applicationId?: string) {
  return useQuery({
    queryKey: ['overview', applicationId],
    queryFn: () => api.getOverview(applicationId),
    staleTime: 30_000,
  });
}
