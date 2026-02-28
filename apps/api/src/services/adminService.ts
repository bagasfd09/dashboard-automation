import { prisma } from '@qc-monitor/db';
import type { RunStatus, TestStatus } from '@qc-monitor/db';
import type { Client as MinioClient } from 'minio';

// ── Teams overview ────────────────────────────────────────────────────────────

export interface TeamSummary {
  id: string;
  name: string;
  createdAt: Date;
  totalTestCases: number;
  totalRuns: number;
  lastRunAt: Date | null;
  lastRunStatus: RunStatus | null;
  passRate: number;
}

export async function listTeamsWithStats(teamIds?: string[]): Promise<TeamSummary[]> {
  const where = teamIds ? { id: { in: teamIds } } : {};
  const teamFilter = teamIds ? { teamId: { in: teamIds } } : {};

  const [teams, runAggs] = await Promise.all([
    prisma.team.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { testCases: true, testRuns: true } },
        testRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { startedAt: true, status: true },
        },
      },
    }),
    prisma.testRun.groupBy({
      by: ['teamId'],
      where: teamIds ? { teamId: { in: teamIds } } : undefined,
      _sum: { passed: true, totalTests: true },
    }),
  ]);

  const aggMap = new Map(runAggs.map((a) => [a.teamId, a._sum]));

  return teams.map((team) => {
    const agg = aggMap.get(team.id);
    const totalTests = agg?.totalTests ?? 0;
    const passed = agg?.passed ?? 0;
    const lastRun = team.testRuns[0] ?? null;

    return {
      id: team.id,
      name: team.name,
      createdAt: team.createdAt,
      totalTestCases: team._count.testCases,
      totalRuns: team._count.testRuns,
      lastRunAt: lastRun?.startedAt ?? null,
      lastRunStatus: (lastRun?.status ?? null) as RunStatus | null,
      passRate: totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0,
    };
  });
}

// ── Dashboard overview ────────────────────────────────────────────────────────

export interface RecentActivityItem {
  id: string;
  status: TestStatus;
  testCaseTitle: string;
  teamName: string;
  teamId: string;
  testRunId: string;
  startedAt: Date;
}

export interface OverviewStats {
  totalTeams: number;
  totalTestCases: number;
  totalRuns: number;
  todayRuns: number;
  overallPassRate: number;
  runsByStatus: {
    running: number;
    passed: number;
    failed: number;
    cancelled: number;
  };
  recentActivity: RecentActivityItem[];
}

export async function getOverview(teamIds?: string[], applicationId?: string): Promise<OverviewStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const teamWhere = teamIds ? { id: { in: teamIds } } : {};
  const appFilter = applicationId ? { applicationId } : {};
  const runWhere = {
    ...(teamIds ? { teamId: { in: teamIds } } : {}),
    ...appFilter,
  };
  const tcWhere = {
    ...(teamIds ? { teamId: { in: teamIds } } : {}),
    ...appFilter,
  };

  const [
    totalTeams,
    totalTestCases,
    totalRuns,
    todayRuns,
    runsByStatusRaw,
    sumsRaw,
    recentRaw,
  ] = await Promise.all([
    prisma.team.count({ where: teamWhere }),
    prisma.testCase.count({ where: tcWhere }),
    prisma.testRun.count({ where: runWhere }),
    prisma.testRun.count({ where: { ...runWhere, startedAt: { gte: todayStart } } }),
    prisma.testRun.groupBy({
      by: ['status'],
      where: runWhere,
      _count: { id: true },
    }),
    prisma.testRun.aggregate({ where: runWhere, _sum: { passed: true, totalTests: true } }),
    prisma.testResult.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      where: {
        ...(teamIds ? { testRun: { teamId: { in: teamIds }, ...appFilter } } : {}),
        ...(!teamIds && applicationId ? { testRun: appFilter } : {}),
      },
      include: {
        testCase: { select: { title: true } },
        testRun: {
          select: {
            id: true,
            teamId: true,
            team: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const runsByStatus = { running: 0, passed: 0, failed: 0, cancelled: 0 };
  for (const r of runsByStatusRaw) {
    const key = r.status.toLowerCase() as keyof typeof runsByStatus;
    if (key in runsByStatus) runsByStatus[key] = r._count.id;
  }

  const totalTests = sumsRaw._sum.totalTests ?? 0;
  const totalPassed = sumsRaw._sum.passed ?? 0;
  const overallPassRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  const recentActivity: RecentActivityItem[] = recentRaw.map((r) => ({
    id: r.id,
    status: r.status as TestStatus,
    testCaseTitle: r.testCase.title,
    teamName: r.testRun.team.name,
    teamId: r.testRun.teamId,
    testRunId: r.testRun.id,
    startedAt: r.startedAt,
  }));

  return {
    totalTeams,
    totalTestCases,
    totalRuns,
    todayRuns,
    overallPassRate,
    runsByStatus,
    recentActivity,
  };
}

// ── Team detail stats ─────────────────────────────────────────────────────────

export interface TopFailingTest {
  id: string;
  title: string;
  failureCount: number;
}

export interface RecentRun {
  id: string;
  status: RunStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  startedAt: Date;
  duration: number | null;
}

export interface TeamDetailStats {
  team: { id: string; name: string; createdAt: Date };
  testCases: { total: number; withFailures: number; withoutRuns: number };
  runs: { total: number; thisWeek: number; passRate: number; avgDuration: number };
  topFailingTests: TopFailingTest[];
  recentRuns: RecentRun[];
}

export async function getTeamDetailStats(teamId: string): Promise<TeamDetailStats | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const [
    totalTestCases,
    withFailures,
    withoutRuns,
    totalRuns,
    thisWeekRuns,
    passRateAgg,
    avgDurationAgg,
    topFailingRaw,
    recentRuns,
  ] = await Promise.all([
    prisma.testCase.count({ where: { teamId } }),
    prisma.testCase.count({ where: { teamId, results: { some: { status: 'FAILED' } } } }),
    prisma.testCase.count({ where: { teamId, results: { none: {} } } }),
    prisma.testRun.count({ where: { teamId } }),
    prisma.testRun.count({ where: { teamId, startedAt: { gte: weekStart } } }),
    prisma.testRun.aggregate({ where: { teamId }, _sum: { passed: true, totalTests: true } }),
    prisma.testRun.aggregate({
      where: { teamId, duration: { not: null } },
      _avg: { duration: true },
    }),
    prisma.testResult.groupBy({
      by: ['testCaseId'],
      where: { status: 'FAILED', testRun: { teamId } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
    prisma.testRun.findMany({
      where: { teamId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        totalTests: true,
        passed: true,
        failed: true,
        skipped: true,
        startedAt: true,
        duration: true,
      },
    }),
  ]);

  const topIds = topFailingRaw.map((r) => r.testCaseId);
  const topTestCases =
    topIds.length > 0
      ? await prisma.testCase.findMany({
          where: { id: { in: topIds } },
          select: { id: true, title: true },
        })
      : [];
  const tcMap = new Map(topTestCases.map((tc) => [tc.id, tc.title]));

  const topFailingTests: TopFailingTest[] = topFailingRaw.map((r) => ({
    id: r.testCaseId,
    title: tcMap.get(r.testCaseId) ?? r.testCaseId,
    failureCount: r._count.id,
  }));

  const totalTests = passRateAgg._sum.totalTests ?? 0;
  const passed = passRateAgg._sum.passed ?? 0;
  const passRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
  const avgDuration = Math.round(avgDurationAgg._avg.duration ?? 0);

  return {
    team: { id: team.id, name: team.name, createdAt: team.createdAt },
    testCases: { total: totalTestCases, withFailures, withoutRuns },
    runs: { total: totalRuns, thisWeek: thisWeekRuns, passRate, avgDuration },
    topFailingTests,
    recentRuns: recentRuns as RecentRun[],
  };
}

// ── Activity log ──────────────────────────────────────────────────────────────

export async function listActivityLog(filters: {
  teamId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  scopeTeamIds?: string[];
}) {
  const { teamId, userId, action, from, to, scopeTeamIds } = filters;
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (userId) where['userId'] = userId;
  if (action) where['action'] = { contains: action };
  if (teamId) {
    where['teamId'] = teamId;
  } else if (scopeTeamIds) {
    where['teamId'] = { in: scopeTeamIds };
  }
  if (from || to) {
    where['createdAt'] = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    data: items,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
}

// ── Admin artifact download ───────────────────────────────────────────────────

export async function getAdminArtifactDownloadUrl(
  id: string,
  minio: MinioClient,
): Promise<string | null> {
  const artifact = await prisma.artifact.findUnique({
    where: { id },
    select: { fileUrl: true },
  });
  if (!artifact) return null;
  return minio.presignedGetObject('qc-artifacts', artifact.fileUrl, 3600);
}
