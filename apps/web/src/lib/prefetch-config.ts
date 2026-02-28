import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';

const STALE: Record<string, number> = {
  overview: 30_000,
  runs: 15_000,
  'test-cases': 30_000,
  retries: 30_000,
  library: 120_000,
  releases: 60_000,
  users: 300_000,
  activity: 30_000,
  teams: 300_000,
};

export function prefetchForPath(
  queryClient: QueryClient,
  path: string,
  ctx?: { applicationId?: string; teamId?: string },
): void {
  const appId = ctx?.applicationId;

  switch (path) {
    case '/':
      queryClient.prefetchQuery({
        queryKey: ['overview', appId],
        queryFn: () => api.getOverview(appId),
        staleTime: STALE.overview,
      });
      break;
    case '/runs':
      queryClient.prefetchQuery({
        queryKey: ['runs', 1, 20, undefined, undefined, undefined, undefined, appId],
        queryFn: () => api.getRuns({ page: 1, pageSize: 20, applicationId: appId }),
        staleTime: STALE.runs,
      });
      break;
    case '/test-cases':
      queryClient.prefetchQuery({
        queryKey: ['test-cases-grouped', 'suite', {}, 1, 10, 5],
        queryFn: () => api.getTestCasesGrouped({ groupBy: 'suite', page: 1, pageSize: 10, innerPageSize: 5 }),
        staleTime: STALE['test-cases'],
      });
      break;
    case '/retries':
      queryClient.prefetchQuery({
        queryKey: ['retries', 1, 20],
        queryFn: () => api.getRetries({ page: 1, pageSize: 20 }),
        staleTime: STALE.retries,
      });
      break;
    case '/library':
      queryClient.prefetchQuery({
        queryKey: ['library-collections', undefined],
        queryFn: () => api.getCollections(),
        staleTime: STALE.library,
      });
      break;
    case '/releases':
      queryClient.prefetchQuery({
        queryKey: ['releases', {}],
        queryFn: () => api.getReleases({ pageSize: 100 }),
        staleTime: STALE.releases,
      });
      break;
    case '/users':
      queryClient.prefetchQuery({
        queryKey: ['users', {}],
        queryFn: () => api.getUsers({}),
        staleTime: STALE.users,
      });
      break;
    case '/activity':
      queryClient.prefetchQuery({
        queryKey: ['activity', 1, ''],
        queryFn: () => api.getActivityLog({ page: 1, pageSize: 25 }),
        staleTime: STALE.activity,
      });
      break;
    case '/teams':
      queryClient.prefetchQuery({
        queryKey: ['teams'],
        queryFn: () => api.getTeams(),
        staleTime: STALE.teams,
      });
      break;
  }
}
