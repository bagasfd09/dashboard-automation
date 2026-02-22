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
) {
  return useQuery({
    queryKey: ['test-cases-grouped', groupBy, filters],
    queryFn: () => api.getTestCasesGrouped({ ...filters, groupBy }),
  });
}

export function useTestCase(id: string) {
  return useQuery({
    queryKey: ['test-case', id],
    queryFn: () => api.getTestCase(id),
    enabled: !!id,
  });
}
