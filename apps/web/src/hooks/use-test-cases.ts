import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TestCaseFilters {
  search?: string;
  tag?: string;
  teamId?: string;
}

export function useTestCases(filters: TestCaseFilters = {}, page = 1, pageSize = 20) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['test-cases', filters, page, pageSize],
    queryFn: () => api.getTestCases({ ...filters, page, pageSize }),
    staleTime: 30_000,
  });

  function prefetchNext() {
    if (!query.data) return;
    const { totalPages } = query.data.pagination;
    if (page < totalPages) {
      void queryClient.prefetchQuery({
        queryKey: ['test-cases', filters, page + 1, pageSize],
        queryFn: () => api.getTestCases({ ...filters, page: page + 1, pageSize }),
      });
    }
  }

  return { ...query, prefetchNext };
}

export function useGroupedTestCases(
  groupBy: 'suite' | 'filePath' | 'tag' | 'team',
  filters: TestCaseFilters = {},
  page = 1,
  pageSize = 10,
  innerPageSize = 5,
) {
  return useQuery({
    queryKey: ['test-cases-grouped', groupBy, filters, page, pageSize, innerPageSize],
    queryFn: () =>
      api.getTestCasesGrouped({
        ...filters,
        groupBy,
        page,
        pageSize,
        // Only pass innerPageSize for suite groupBy (backend only uses it there)
        innerPageSize: groupBy === 'suite' ? innerPageSize : undefined,
      }),
    staleTime: 30_000,
  });
}

export function useSuiteTestCases(
  suiteName: string,
  teamId: string | undefined,
  page: number,
  pageSize: number,
  filters: TestCaseFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['suite-test-cases', suiteName, teamId, page, pageSize, filters],
    queryFn: () =>
      api.getSuiteTestCases({ suiteName, teamId, page, pageSize, ...filters }),
    enabled,
    staleTime: 30_000,
  });
}

export function useTestCase(id: string) {
  return useQuery({
    queryKey: ['test-case', id],
    queryFn: () => api.getTestCase(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}
