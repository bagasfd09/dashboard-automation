import { prisma } from '@qc-monitor/db';
import type { TestRun, RunStatus } from '@qc-monitor/db';
import { eventService } from './eventService.js';

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

type TestRunWithTeam = TestRun & { team: { id: string; name: string } };

// ── Types for paginated run detail ────────────────────────────────────────────

type TestResultDetailed = {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: string;
  duration: number | null;
  error: string | null;
  retryCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  testCase: {
    id: string;
    title: string;
    filePath: string;
    suiteName: string | null;
    tags: string[];
    teamId: string;
  };
  artifacts: {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    createdAt: Date;
    testResultId: string;
  }[];
};

export interface RunDetailPaginated {
  run: TestRunWithTeam & { finishedAt: Date | null };
  results: {
    data: TestResultDetailed[];
    pagination: PaginationMeta;
  };
}

export interface RunResultGroup {
  suiteName: string;
  results: TestResultDetailed[];
  stats: { total: number; passed: number; failed: number; skipped: number };
  pagination: PaginationMeta;
}

export interface RunResultsGrouped {
  run: TestRunWithTeam & { finishedAt: Date | null };
  groups: RunResultGroup[];
  pagination: PaginationMeta;
}

// ── Create / Update ───────────────────────────────────────────────────────────

export async function createRun(teamId: string): Promise<TestRun> {
  const run = await prisma.testRun.create({ data: { teamId } });
  eventService.broadcast(teamId, 'run:started', run);
  return run;
}

interface UpdateRunBody {
  status?: RunStatus;
  duration?: number;
}

export async function updateRun(
  id: string,
  teamId: string,
  body: UpdateRunBody,
): Promise<TestRun | null> {
  const run = await prisma.testRun.findUnique({ where: { id } });
  if (!run || run.teamId !== teamId) return null;

  const results = await prisma.testResult.groupBy({
    by: ['status'],
    where: { testRunId: id },
    _count: { status: true },
  });

  const counts = { passed: 0, failed: 0, skipped: 0, totalTests: 0 };
  for (const r of results) {
    const n = r._count.status;
    counts.totalTests += n;
    if (r.status === 'PASSED') counts.passed = n;
    else if (r.status === 'FAILED') counts.failed = n;
    else if (r.status === 'SKIPPED') counts.skipped = n;
  }

  const updated = await prisma.testRun.update({
    where: { id },
    data: {
      ...counts,
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.duration !== undefined ? { duration: body.duration } : {}),
      ...(body.status !== undefined && body.status !== 'RUNNING' ? { finishedAt: new Date() } : {}),
    },
  });
  eventService.broadcast(teamId, 'run:finished', updated);
  return updated;
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listRuns(
  teamId: string | undefined,
  page: number | string = 1,
  pageSize: number | string = 20,
  scopeTeamIds?: string[],
): Promise<PaginatedResult<TestRunWithTeam>> {
  const _page = Number(page);
  const _pageSize = Number(pageSize);
  const skip = (_page - 1) * _pageSize;
  const where: Record<string, unknown> = teamId
    ? { teamId }
    : scopeTeamIds
      ? { teamId: { in: scopeTeamIds } }
      : {};
  const [items, totalItems] = await Promise.all([
    prisma.testRun.findMany({
      where,
      skip,
      take: _pageSize,
      orderBy: { startedAt: 'desc' },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.testRun.count({ where }),
  ]);
  return {
    data: items as TestRunWithTeam[],
    pagination: { page: _page, pageSize: _pageSize, totalItems, totalPages: Math.ceil(totalItems / _pageSize) || 1 },
  };
}

// ── Get (original — used by team-scoped route, reporter) ─────────────────────

export async function getRun(id: string, teamId: string | undefined): Promise<unknown> {
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true } },
      results: {
        include: { testCase: true, artifacts: true },
      },
    },
  });
  if (!run) return null;
  if (teamId !== undefined && run.teamId !== teamId) return null;
  return run;
}

// ── Get paginated (admin dashboard) ──────────────────────────────────────────

export async function getPaginatedRun(
  id: string,
  teamId: string | undefined,
  options: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  } = {},
): Promise<RunDetailPaginated | null> {
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!run) return null;
  if (teamId !== undefined && run.teamId !== teamId) return null;

  const page = Number(options.page ?? 1);
  const pageSize = Number(options.pageSize ?? 20);
  const skip = (page - 1) * pageSize;

  const resultWhere: Record<string, unknown> = { testRunId: id };
  if (options.status) resultWhere['status'] = options.status;
  if (options.search) {
    resultWhere['testCase'] = {
      title: { contains: options.search, mode: 'insensitive' },
    };
  }

  const [results, totalItems] = await Promise.all([
    prisma.testResult.findMany({
      where: resultWhere,
      skip,
      take: pageSize,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      include: {
        testCase: {
          select: { id: true, title: true, filePath: true, suiteName: true, tags: true, teamId: true },
        },
        artifacts: true,
      },
    }),
    prisma.testResult.count({ where: resultWhere }),
  ]);

  return {
    run: run as TestRunWithTeam & { finishedAt: Date | null },
    results: {
      data: results as TestResultDetailed[],
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
      },
    },
  };
}

// ── Get results grouped by suite (admin dashboard) ───────────────────────────

export async function getRunResultsGrouped(
  id: string,
  teamId: string | undefined,
  options: {
    page?: number;
    pageSize?: number;
    innerPageSize?: number;
    status?: string;
  } = {},
): Promise<RunResultsGrouped | null> {
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!run) return null;
  if (teamId !== undefined && run.teamId !== teamId) return null;

  const page = Number(options.page ?? 1);
  const pageSize = Number(options.pageSize ?? 10);
  const innerPageSize = Number(options.innerPageSize ?? 5);

  const resultWhere: Record<string, unknown> = { testRunId: id };
  if (options.status) resultWhere['status'] = options.status;

  // Load all results with testCase.suiteName for grouping
  const allResults = await prisma.testResult.findMany({
    where: resultWhere,
    orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
    include: {
      testCase: {
        select: { id: true, title: true, filePath: true, suiteName: true, tags: true, teamId: true },
      },
      artifacts: true,
    },
  }) as TestResultDetailed[];

  // Group by suiteName
  const groupMap = new Map<string, TestResultDetailed[]>();
  for (const r of allResults) {
    const key = r.testCase.suiteName ?? '(no suite)';
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(r);
  }

  // Build groups with stats
  const allGroups: RunResultGroup[] = [];
  for (const [suiteName, rList] of groupMap) {
    let passed = 0, failed = 0, skipped = 0;
    for (const r of rList) {
      if (r.status === 'PASSED') passed++;
      else if (r.status === 'FAILED' || r.status === 'RETRIED') failed++;
      else if (r.status === 'SKIPPED') skipped++;
    }
    const total = rList.length;
    allGroups.push({
      suiteName,
      results: rList.slice(0, innerPageSize),
      stats: { total, passed, failed, skipped },
      pagination: {
        page: 1,
        pageSize: innerPageSize,
        totalItems: total,
        totalPages: Math.ceil(total / innerPageSize) || 1,
      },
    });
  }

  // Sort: suites with failures first
  allGroups.sort((a, b) => {
    if (a.stats.failed > 0 && b.stats.failed === 0) return -1;
    if (a.stats.failed === 0 && b.stats.failed > 0) return 1;
    return a.suiteName.localeCompare(b.suiteName);
  });

  const totalGroupItems = allGroups.length;
  const skip = (page - 1) * pageSize;
  const pagedGroups = allGroups.slice(skip, skip + pageSize);

  return {
    run: run as TestRunWithTeam & { finishedAt: Date | null },
    groups: pagedGroups,
    pagination: {
      page,
      pageSize,
      totalItems: totalGroupItems,
      totalPages: Math.ceil(totalGroupItems / pageSize) || 1,
    },
  };
}
