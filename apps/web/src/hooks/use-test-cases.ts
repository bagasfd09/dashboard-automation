import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TestCaseFilters {
  search?: string;
  tag?: string;
  teamId?: string;
}

export function useTestCases(filters: TestCaseFilters = {}, page = 1) {
  return useQuery({
    queryKey: ['test-cases', filters, page],
    queryFn: () => api.getTestCases({ ...filters, page, limit: 20 }),
  });
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
