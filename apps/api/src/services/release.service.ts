import { prisma } from '@qc-monitor/db';
import type {
  Release,
  ReleaseChecklistItem,
  ReleaseStatus,
  ChecklistItemType,
  ChecklistItemStatus,
  Prisma,
} from '@qc-monitor/db';

// ── Releases ──────────────────────────────────────────────────────────────────

type ReleaseFilters = {
  teamId?: string;
  status?: ReleaseStatus;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listReleases(filters: ReleaseFilters = {}): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;

  const where: Prisma.ReleaseWhereInput = {};
  if (filters.teamId) where.teamId = filters.teamId;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { version: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    prisma.release.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { checklistItems: true } },
      },
    }),
    prisma.release.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

export async function getRelease(id: string): Promise<unknown | null> {
  return prisma.release.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      checklistItems: {
        orderBy: { order: 'asc' },
        include: {
          libraryTestCase: { select: { id: true, title: true, priority: true } },
          testCase: { select: { id: true, title: true, filePath: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      },
      testRuns: {
        include: {
          testRun: {
            select: {
              id: true,
              status: true,
              passed: true,
              failed: true,
              totalTests: true,
              startedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
}

export async function createRelease(data: {
  name: string;
  version: string;
  description?: string;
  teamId?: string;
  targetDate?: Date;
  createdById: string;
}): Promise<Release> {
  return prisma.release.create({ data });
}

export async function updateRelease(
  id: string,
  data: {
    name?: string;
    version?: string;
    description?: string;
    targetDate?: Date | null;
    status?: ReleaseStatus;
  },
): Promise<Release | null> {
  return prisma.release.update({ where: { id }, data }).catch(() => null);
}

export async function deleteRelease(id: string): Promise<boolean> {
  try {
    await prisma.release.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function markReleased(
  id: string,
): Promise<{ release: Release; blockers: ReleaseChecklistItem[] }> {
  const blockers = await prisma.releaseChecklistItem.findMany({
    where: {
      releaseId: id,
      status: { in: ['PENDING', 'IN_PROGRESS', 'FAILED', 'BLOCKED'] },
    },
    orderBy: { order: 'asc' },
  });

  if (blockers.length > 0) {
    throw Object.assign(new Error('Release has unresolved checklist items'), { blockers });
  }

  const release = await prisma.release.update({
    where: { id },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });

  return { release, blockers: [] };
}

export async function cancelRelease(id: string): Promise<Release | null> {
  return prisma.release
    .update({ where: { id }, data: { status: 'CANCELLED' } })
    .catch(() => null);
}

// ── Checklist items ───────────────────────────────────────────────────────────

export async function addChecklistItem(data: {
  releaseId: string;
  type: ChecklistItemType;
  title: string;
  description?: string;
  libraryTestCaseId?: string;
  testCaseId?: string;
  order?: number;
  assignedToId?: string;
}): Promise<ReleaseChecklistItem> {
  if (data.order === undefined) {
    const last = await prisma.releaseChecklistItem.findFirst({
      where: { releaseId: data.releaseId },
      orderBy: { order: 'desc' },
    });
    data.order = (last?.order ?? -1) + 1;
  }
  return prisma.releaseChecklistItem.create({ data });
}

export async function updateChecklistItem(
  id: string,
  data: {
    title?: string;
    description?: string;
    status?: ChecklistItemStatus;
    assignedToId?: string | null;
    order?: number;
    notes?: string;
  },
): Promise<ReleaseChecklistItem | null> {
  const update: typeof data & { completedAt?: Date | null } = { ...data };

  if (data.status === 'PASSED' || data.status === 'SKIPPED') {
    update.completedAt = new Date();
  } else if (
    data.status === 'PENDING' ||
    data.status === 'IN_PROGRESS' ||
    data.status === 'FAILED' ||
    data.status === 'BLOCKED'
  ) {
    update.completedAt = null;
  }

  return prisma.releaseChecklistItem.update({ where: { id }, data: update }).catch(() => null);
}

export async function deleteChecklistItem(id: string): Promise<boolean> {
  try {
    await prisma.releaseChecklistItem.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ── Run linking ───────────────────────────────────────────────────────────────

export async function linkRunToRelease(releaseId: string, testRunId: string): Promise<unknown> {
  return prisma.releaseTestRun.upsert({
    where: { releaseId_testRunId: { releaseId, testRunId } },
    create: { releaseId, testRunId },
    update: {},
  });
}

export async function unlinkRunFromRelease(releaseId: string, testRunId: string): Promise<boolean> {
  try {
    await prisma.releaseTestRun.delete({
      where: { releaseId_testRunId: { releaseId, testRunId } },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getReleaseStats(id: string): Promise<unknown> {
  const [items, testRuns] = await Promise.all([
    prisma.releaseChecklistItem.groupBy({
      by: ['status'],
      where: { releaseId: id },
      _count: { status: true },
    }),
    prisma.releaseTestRun.findMany({
      where: { releaseId: id },
      include: {
        testRun: {
          select: {
            id: true,
            status: true,
            passed: true,
            failed: true,
            skipped: true,
            totalTests: true,
            startedAt: true,
            finishedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    items.map((i) => [i.status, i._count.status]),
  ) as Record<string, number>;

  const total = items.reduce((sum, i) => sum + i._count.status, 0);
  const completed = (statusCounts['PASSED'] ?? 0) + (statusCounts['SKIPPED'] ?? 0);
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    checklistProgress: { total, completed, progress, byStatus: statusCounts },
    testRuns: testRuns.map((r) => r.testRun),
  };
}

// ── Auto-update on test run finish ────────────────────────────────────────────

/**
 * Called when a TestRun finishes. Auto-updates AUTOMATED_TEST checklist items
 * linked to test cases in this run.
 */
export async function onRunFinished(testRunId: string): Promise<void> {
  const releaseLinks = await prisma.releaseTestRun.findMany({
    where: { testRunId },
    select: { releaseId: true },
  });

  if (releaseLinks.length === 0) return;

  const results = await prisma.testResult.findMany({
    where: { testRunId },
    select: { testCaseId: true, status: true },
  });

  const resultByTestCase = new Map(results.map((r) => [r.testCaseId, r.status]));

  for (const { releaseId } of releaseLinks) {
    const items = await prisma.releaseChecklistItem.findMany({
      where: {
        releaseId,
        type: 'AUTOMATED_TEST',
        testCaseId: { not: null },
        status: { in: ['PENDING', 'IN_PROGRESS', 'FAILED'] },
      },
    });

    for (const item of items) {
      if (!item.testCaseId) continue;
      const status = resultByTestCase.get(item.testCaseId);
      if (!status) continue;

      const newStatus: ChecklistItemStatus =
        status === 'PASSED' ? 'PASSED'
        : status === 'FAILED' || status === 'RETRIED' ? 'FAILED'
        : 'SKIPPED';

      await prisma.releaseChecklistItem.update({
        where: { id: item.id },
        data: {
          status: newStatus,
          completedAt: newStatus === 'PASSED' || newStatus === 'SKIPPED' ? new Date() : null,
        },
      });
    }
  }
}
