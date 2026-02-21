import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(),
    staleTime: 60_000,
  });
}

export function useTeamStats(teamId: string) {
  return useQuery({
    queryKey: ['team-stats', teamId],
    queryFn: () => api.getTeamStats(teamId),
    enabled: !!teamId,
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => api.getOverview(),
  });
}
