import type {
  Paginated,
  PaginationMeta,
  TestCase,
  TestCaseDetail,
  TestRun,
  RunDetailPaginated,
  RunResultsGrouped,
  TeamSummary,
  TeamDetailStats,
  OverviewStats,
  GroupedTestCases,
  RetryRequest,
  LoginResponse,
  AuthUser,
  Session,
  UserRecord,
  ActivityLogEntry,
  InviteRecord,
  UserRole,
} from './types';

export type { PaginationMeta };

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? '';

// ── In-memory access token ────────────────────────────────────────────────────

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit & { _retry?: boolean }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  } else if (ADMIN_KEY) {
    headers['x-admin-key'] = ADMIN_KEY;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  // Auto-refresh on 401 (once)
  if (res.status === 401 && !init?._retry) {
    try {
      const refreshed = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (refreshed.ok) {
        const data = (await refreshed.json()) as { accessToken: string };
        setAccessToken(data.accessToken);
        return apiFetch<T>(path, { ...init, _retry: true });
      }
    } catch {
      // ignore, fall through to throw
    }
    setAccessToken(null);
    // Dispatch event so AuthProvider can redirect
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }

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
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }),

  // Use raw fetch — bypasses the 401 auto-refresh loop in apiFetch so that
  // a missing/expired cookie on page load is handled gracefully by AuthProvider
  // without dispatching auth:unauthorized.
  refreshToken: async (): Promise<{ accessToken: string; user: AuthUser }> => {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    return res.json() as Promise<{ accessToken: string; user: AuthUser }>;
  },

  getMe: () => apiFetch<AuthUser>('/api/auth/me'),

  updateMe: (name: string) =>
    apiFetch<{ message: string }>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  acceptInvite: (token: string, name: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, name, password }),
    }),

  getSessions: () => apiFetch<Session[]>('/api/auth/me/sessions'),

  revokeSession: (tokenId: string) =>
    apiFetch<{ message: string }>(`/api/auth/me/sessions/${tokenId}`, { method: 'DELETE' }),

  // ── Overview ──────────────────────────────────────────────────────────────
  getOverview: () => apiFetch<OverviewStats>('/api/admin/overview'),

  // ── Teams ─────────────────────────────────────────────────────────────────
  getTeams: () => apiFetch<TeamSummary[]>('/api/admin/teams'),
  getTeamStats: (teamId: string) =>
    apiFetch<TeamDetailStats>(`/api/admin/teams/${teamId}/stats`),
  createTeam: (name: string) =>
    apiFetch<{ id: string; name: string }>('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateTeam: (id: string, name: string) =>
    apiFetch<{ id: string; name: string }>(`/api/admin/teams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  deleteTeam: (id: string) =>
    apiFetch<{ message: string }>(`/api/admin/teams/${id}`, { method: 'DELETE' }),
  rotateApiKey: (teamId: string) =>
    apiFetch<{ message: string; newKey: string }>(`/api/admin/teams/${teamId}/api-keys/rotate`, { method: 'POST' }),
  getApiKeys: (teamId: string) =>
    apiFetch<{ id: string; key: string; teamId: string }[]>(`/api/admin/teams/${teamId}/api-keys`),

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers: (p: { role?: UserRole; teamId?: string; search?: string; isActive?: string; page?: number; pageSize?: number }) =>
    apiFetch<Paginated<UserRecord>>(`/api/admin/users?${qs(p)}`),

  getUser: (id: string) => apiFetch<UserRecord>(`/api/admin/users/${id}`),

  inviteUser: (data: { email: string; role: UserRole; teamIds?: string[] }) =>
    apiFetch<{ invite: InviteRecord; inviteLink: string }>('/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: { name?: string; role?: UserRole; isActive?: boolean; teamIds?: string[] }) =>
    apiFetch<{ message: string }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    apiFetch<{ message: string }>(`/api/admin/users/${id}`, { method: 'DELETE' }),

  resetUserPassword: (id: string) =>
    apiFetch<{ resetLink: string }>(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),

  forceLogout: (id: string) =>
    apiFetch<{ message: string }>(`/api/admin/users/${id}/force-logout`, { method: 'POST' }),

  toggleUserActive: (id: string, isActive: boolean) =>
    apiFetch<{ message: string }>(`/api/admin/users/${id}/toggle-active`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    }),

  // ── Activity log ──────────────────────────────────────────────────────────
  getActivityLog: (p: { teamId?: string; userId?: string; action?: string; page?: number; pageSize?: number }) =>
    apiFetch<Paginated<ActivityLogEntry>>(`/api/admin/activity-log?${qs(p)}`),

  // ── Test cases ────────────────────────────────────────────────────────────
  getTestCases: (p: {
    search?: string;
    status?: string;
    tag?: string;
    teamId?: string;
    page?: number;
    pageSize?: number;
  }) => apiFetch<Paginated<TestCase>>(`/api/admin/test-cases?${qs(p)}`),

  getTestCasesGrouped: (p: {
    search?: string;
    tag?: string;
    teamId?: string;
    groupBy: 'suite' | 'filePath' | 'tag' | 'team';
    page?: number;
    pageSize?: number;
    innerPageSize?: number;
  }) => apiFetch<GroupedTestCases>(`/api/admin/test-cases?${qs(p)}`),

  getSuiteTestCases: (p: {
    suiteName: string;
    teamId?: string;
    page: number;
    pageSize: number;
    search?: string;
    tag?: string;
  }) => apiFetch<Paginated<TestCase>>(`/api/admin/test-cases/by-suite?${qs(p)}`),

  getTestCase: (id: string) =>
    apiFetch<TestCaseDetail>(`/api/admin/test-cases/${id}`),

  // ── Retries ───────────────────────────────────────────────────────────────
  requestRetry: (testCaseId: string, teamId: string) =>
    apiFetch<RetryRequest>('/api/admin/retry', {
      method: 'POST',
      body: JSON.stringify({ testCaseId, teamId }),
    }),
  getRetries: (p: { teamId?: string; page?: number; pageSize?: number }) =>
    apiFetch<Paginated<RetryRequest>>(`/api/admin/retries?${qs(p)}`),

  // ── Runs ──────────────────────────────────────────────────────────────────
  getRuns: (p: { page?: number; pageSize?: number; teamId?: string }) =>
    apiFetch<Paginated<TestRun>>(`/api/admin/runs?${qs(p)}`),

  getRun: (
    id: string,
    params?: { page?: number; pageSize?: number; status?: string; search?: string },
  ) => apiFetch<RunDetailPaginated>(`/api/admin/runs/${id}?${qs(params ?? {})}`),

  getRunResultsGrouped: (
    id: string,
    params?: { page?: number; pageSize?: number; innerPageSize?: number; status?: string },
  ) => apiFetch<RunResultsGrouped>(`/api/admin/runs/${id}/results-grouped?${qs(params ?? {})}`),

  // ── Artifacts (via Next.js proxy route — handles auth server-side) ────────
  artifactProxyUrl: (id: string) => `/api/artifact-proxy/${id}`,
};

export { BASE, ADMIN_KEY };
