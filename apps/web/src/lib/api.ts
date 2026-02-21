import type {
  Paginated,
  TestCase,
  TestCaseDetail,
  TestRun,
  RunDetail,
  TeamSummary,
  TeamDetailStats,
  OverviewStats,
  GroupedTestCases,
  RetryRequest,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'x-admin-key': ADMIN_KEY,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function qs(params: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
}

export const api = {
  // ── Overview ──────────────────────────────────────────────────────────────
  getOverview: () =>
    apiFetch<OverviewStats>('/api/admin/overview'),

  // ── Teams ─────────────────────────────────────────────────────────────────
  getTeams: () =>
    apiFetch<TeamSummary[]>('/api/admin/teams'),
  getTeamStats: (teamId: string) =>
    apiFetch<TeamDetailStats>(`/api/admin/teams/${teamId}/stats`),

  // ── Test cases ────────────────────────────────────────────────────────────
  getTestCases: (p: {
    search?: string;
    status?: string;
    tag?: string;
    teamId?: string;
    page?: number;
    limit?: number;
  }) => apiFetch<Paginated<TestCase>>(`/api/admin/test-cases?${qs(p)}`),
  getTestCasesGrouped: (p: {
    search?: string;
    tag?: string;
    teamId?: string;
    groupBy: 'suite' | 'filePath' | 'tag' | 'team';
  }) => apiFetch<GroupedTestCases>(`/api/admin/test-cases?${qs(p)}`),
  getTestCase: (id: string) =>
    apiFetch<TestCaseDetail>(`/api/admin/test-cases/${id}`),

  // ── Retries ───────────────────────────────────────────────────────────────
  requestRetry: (testCaseId: string, teamId: string) =>
    apiFetch<RetryRequest>('/api/admin/retry', {
      method: 'POST',
      body: JSON.stringify({ testCaseId, teamId }),
    }),
  getRetries: (p: { teamId?: string; page?: number; limit?: number }) =>
    apiFetch<Paginated<RetryRequest>>(`/api/admin/retries?${qs(p)}`),

  // ── Runs ──────────────────────────────────────────────────────────────────
  getRuns: (p: { page?: number; limit?: number; teamId?: string }) =>
    apiFetch<Paginated<TestRun>>(`/api/admin/runs?${qs(p)}`),
  getRun: (id: string) =>
    apiFetch<RunDetail>(`/api/admin/runs/${id}`),

  // ── Artifacts (via Next.js proxy route — handles auth server-side) ────────
  artifactProxyUrl: (id: string) => `/api/artifact-proxy/${id}`,
};

export { BASE, ADMIN_KEY };
