import { prisma } from '@qc-monitor/db';
import type { TestRun, RunStatus } from '@qc-monitor/db';
import { eventService } from './eventService.js';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

type TestRunWithTeam = TestRun & { team: { id: string; name: string } };

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

  // Recompute counts from DB
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

export async function listRuns(
  teamId: string | undefined,
  page = 1,
  limit = 20,
): Promise<PaginatedResult<TestRunWithTeam>> {
  const skip = (page - 1) * limit;
  const where = teamId ? { teamId } : {};
  const [items, total] = await Promise.all([
    prisma.testRun.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.testRun.count({ where }),
  ]);
  return { items: items as TestRunWithTeam[], total, page, limit };
}

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
