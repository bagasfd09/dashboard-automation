import { prisma } from '@qc-monitor/db';
import type { TestCase, TestStatus } from '@qc-monitor/db';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ListFilters {
  status?: TestStatus;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  groupBy?: 'suite' | 'filePath' | 'tag' | 'team';
  innerPageSize?: number;
  /** Restrict results to these team IDs (used for role-based scoping). */
  scopeTeamIds?: string[];
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

type TestCaseWithTeam = TestCase & { team: { id: string; name: string } };

type TestCaseWithLatestStatus = TestCaseWithTeam & {
  results: Array<{ status: TestStatus }>;
};

export interface TestCaseGroupStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface TestCaseGroup {
  name: string;
  testCases: TestCaseWithTeam[];
  stats: TestCaseGroupStats;
  /** Inner pagination — always present in grouped responses */
  pagination: PaginationMeta;
}

export interface GroupedTestCasesResult {
  groups: TestCaseGroup[];
  /** Outer (group-level) pagination */
  pagination: PaginationMeta;
}

// ── List (flat + grouped) ──────────────────────────────────────────────────────

export async function listTestCases(
  teamId: string | undefined,
  filters: ListFilters = {},
): Promise<PaginatedResult<TestCaseWithTeam> | GroupedTestCasesResult> {
  const { status, tag, search, groupBy, scopeTeamIds } = filters;
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const innerPageSize = filters.innerPageSize !== undefined ? Number(filters.innerPageSize) : undefined;

  const where: Record<string, unknown> = teamId
    ? { teamId }
    : scopeTeamIds
      ? { teamId: { in: scopeTeamIds } }
      : {};

  if (status) {
    where['results'] = { some: { status } };
  }

  if (tag) {
    where['tags'] = { has: tag };
  }

  if (search) {
    where['OR'] = [
      { title: { contains: search, mode: 'insensitive' } },
      { filePath: { contains: search, mode: 'insensitive' } },
    ];
  }

  // ── Grouped mode ────────────────────────────────────────────────────────────

  if (groupBy) {
    const items = await prisma.testCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        team: { select: { id: true, name: true } },
        results: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    }) as TestCaseWithLatestStatus[];

    const groupMap = new Map<string, TestCaseWithLatestStatus[]>();

    for (const tc of items) {
      let key: string;
      if (groupBy === 'suite') {
        key = tc.suiteName ?? '(no suite)';
      } else if (groupBy === 'filePath') {
        key = tc.filePath;
      } else if (groupBy === 'tag') {
        const tags = tc.tags.length > 0 ? tc.tags : ['(untagged)'];
        for (const t of tags) {
          if (!groupMap.has(t)) groupMap.set(t, []);
          groupMap.get(t)!.push(tc);
        }
        continue;
      } else {
        key = tc.team.name;
      }
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(tc);
    }

    const allGroups: TestCaseGroup[] = [];

    for (const [name, tcs] of groupMap) {
      const total = tcs.length;
      let passed = 0;
      let failed = 0;
      for (const tc of tcs) {
        const latestStatus = tc.results[0]?.status;
        if (latestStatus === 'PASSED') passed++;
        else if (latestStatus === 'FAILED' || latestStatus === 'RETRIED') failed++;
      }
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
      const stats = { total, passed, failed, passRate };

      const effectiveInner = innerPageSize ?? total;
      const pageTestCases = tcs
        .slice(0, effectiveInner)
        .map(({ results: _r, ...rest }) => rest) as TestCaseWithTeam[];

      allGroups.push({
        name,
        testCases: pageTestCases,
        stats,
        pagination: {
          page: 1,
          pageSize: effectiveInner,
          totalItems: total,
          totalPages: innerPageSize ? Math.ceil(total / innerPageSize) : 1,
        },
      });
    }

    // Sort: failing first, then by name
    allGroups.sort((a, b) => {
      if (a.stats.failed > 0 && b.stats.failed === 0) return -1;
      if (a.stats.failed === 0 && b.stats.failed > 0) return 1;
      return a.name.localeCompare(b.name);
    });

    const totalGroupItems = allGroups.length;
    const skip = (page - 1) * pageSize;
    const pagedGroups = allGroups.slice(skip, skip + pageSize);

    return {
      groups: pagedGroups,
      pagination: {
        page,
        pageSize,
        totalItems: totalGroupItems,
        totalPages: Math.ceil(totalGroupItems / pageSize) || 1,
      },
    };
  }

  // ── Flat paginated mode ──────────────────────────────────────────────────────

  const skip = (page - 1) * pageSize;

  const [rawItems, totalItems] = await Promise.all([
    prisma.testCase.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.testCase.count({ where }),
  ]);

  return {
    data: rawItems as TestCaseWithTeam[],
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

// ── List by suite (inner pagination endpoint) ─────────────────────────────────

export async function listTestCasesBySuite(
  suiteName: string,
  teamId: string | undefined,
  page: number | string,
  pageSize: number | string,
  filters: { search?: string; tag?: string; scopeTeamIds?: string[] } = {},
): Promise<PaginatedResult<TestCaseWithTeam>> {
  page = Number(page);
  pageSize = Number(pageSize);
  const where: Record<string, unknown> = {
    suiteName: suiteName === '(no suite)' ? null : suiteName,
  };
  if (teamId) {
    where['teamId'] = teamId;
  } else if (filters.scopeTeamIds) {
    where['teamId'] = { in: filters.scopeTeamIds };
  }
  if (filters.tag) where['tags'] = { has: filters.tag };
  if (filters.search) {
    where['OR'] = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { filePath: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [rawItems, totalItems] = await Promise.all([
    prisma.testCase.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.testCase.count({ where }),
  ]);

  return {
    data: rawItems as TestCaseWithTeam[],
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

// ── Get single ────────────────────────────────────────────────────────────────

type TestCaseWithLatestResult = TestCaseWithTeam & {
  results: Array<{ id: string; status: TestStatus; startedAt: Date; artifacts: unknown[] }>;
};

export async function getTestCase(
  id: string,
  teamId: string | undefined,
): Promise<TestCaseWithLatestResult | null> {
  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true } },
      results: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        include: { artifacts: true },
      },
    },
  });

  if (!testCase) return null;
  if (teamId !== undefined && testCase.teamId !== teamId) return null;

  return testCase as TestCaseWithLatestResult;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

interface SyncTestCase {
  title: string;
  filePath: string;
  tags?: string[];
  suiteName?: string;
}

export async function syncTestCases(teamId: string, testCases: SyncTestCase[]): Promise<TestCase[]> {
  return prisma.$transaction(
    testCases.map((tc) =>
      prisma.testCase.upsert({
        where: {
          teamId_filePath_title: { teamId, filePath: tc.filePath, title: tc.title },
        },
        create: {
          teamId,
          title: tc.title,
          filePath: tc.filePath,
          tags: tc.tags ?? [],
          suiteName: tc.suiteName,
        },
        update: {
          tags: tc.tags ?? [],
          suiteName: tc.suiteName,
        },
      }),
    ),
  );
}
