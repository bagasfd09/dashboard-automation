import { prisma } from '@qc-monitor/db';
import type { RetryRequest, RetryRequestStatus } from '@qc-monitor/db';

// ── Types ──────────────────────────────────────────────────────────────────────

type RetryRequestWithDetails = RetryRequest & {
  testCase: { title: string; filePath: string };
  team: { name: string };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Requests older than 10 minutes that are still PENDING should be treated as expired. */
function tenMinutesAgo(): Date {
  return new Date(Date.now() - 10 * 60 * 1000);
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function createRetryRequest(
  teamId: string,
  testCaseId: string,
): Promise<RetryRequest> {
  return prisma.retryRequest.create({
    data: { teamId, testCaseId },
  });
}

export async function getPendingRetries(teamId: string): Promise<RetryRequestWithDetails[]> {
  const cutoff = tenMinutesAgo();
  return prisma.retryRequest.findMany({
    where: {
      teamId,
      status: 'PENDING',
      requestedAt: { gte: cutoff },
    },
    include: {
      testCase: { select: { title: true, filePath: true } },
      team: { select: { name: true } },
    },
    orderBy: { requestedAt: 'asc' },
  }) as Promise<RetryRequestWithDetails[]>;
}

export async function updateRetryRequest(
  id: string,
  data: { status: RetryRequestStatus; resultId?: string },
): Promise<RetryRequest> {
  const update: Record<string, unknown> = { status: data.status };
  if (data.resultId !== undefined) update['resultId'] = data.resultId;
  if (data.status === 'RUNNING') update['pickedUpAt'] = new Date();
  if (data.status === 'COMPLETED' || data.status === 'EXPIRED') update['completedAt'] = new Date();

  return prisma.retryRequest.update({ where: { id }, data: update });
}

export async function listRetries(params: {
  teamId?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: RetryRequestWithDetails[]; total: number; page: number; limit: number }> {
  const { teamId, page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;
  const where = teamId ? { teamId } : {};

  const [items, total] = await Promise.all([
    prisma.retryRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { requestedAt: 'desc' },
      include: {
        testCase: { select: { title: true, filePath: true } },
        team: { select: { name: true } },
      },
    }),
    prisma.retryRequest.count({ where }),
  ]);

  return { items: items as RetryRequestWithDetails[], total, page, limit };
}

export async function expireOldRequests(): Promise<void> {
  const cutoff = tenMinutesAgo();
  await prisma.retryRequest.updateMany({
    where: { status: 'PENDING', requestedAt: { lt: cutoff } },
    data: { status: 'EXPIRED', completedAt: new Date() },
  });
}
