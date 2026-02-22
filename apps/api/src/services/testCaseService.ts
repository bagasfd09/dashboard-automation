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
}

export interface GroupedTestCasesResult {
  groups: TestCaseGroup[];
}

// ── List (flat + grouped) ──────────────────────────────────────────────────────

export async function listTestCases(
  teamId: string | undefined,
  filters: ListFilters = {},
): Promise<PaginatedResult<TestCaseWithTeam> | GroupedTestCasesResult> {
  const { status, tag, search, page = 1, pageSize = 20, groupBy } = filters;

  const where: Record<string, unknown> = teamId ? { teamId } : {};

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
        // team
        key = tc.team.name;
      }
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(tc);
    }

    const groups: TestCaseGroup[] = [];
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
      // Strip `results` from the returned test cases (not needed by the UI)
      const testCases = tcs.map(({ results: _r, ...rest }) => rest) as TestCaseWithTeam[];
      groups.push({ name, testCases, stats: { total, passed, failed, passRate } });
    }

    // Sort groups: failing first, then by name
    groups.sort((a, b) => {
      if (a.stats.failed > 0 && b.stats.failed === 0) return -1;
      if (a.stats.failed === 0 && b.stats.failed > 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return { groups };
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
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
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
