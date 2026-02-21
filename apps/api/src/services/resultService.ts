import { prisma } from '@qc-monitor/db';
import type { TestResult, TestStatus } from '@qc-monitor/db';
import { eventService } from './eventService.js';

interface CreateResultData {
  testRunId: string;
  testCaseId: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  retryCount?: number;
}

export async function createResult(data: CreateResultData, teamId: string): Promise<TestResult> {
  const result = await prisma.testResult.create({
    data: {
      testRunId: data.testRunId,
      testCaseId: data.testCaseId,
      status: data.status,
      duration: data.duration,
      error: data.error,
      retryCount: data.retryCount ?? 0,
    },
  });
  eventService.broadcast(teamId, 'result:new', result);
  if (result.status === 'FAILED') {
    eventService.broadcast(teamId, 'result:failed', result);
  }
  return result;
}

interface UpdateResultData {
  status?: TestStatus;
  duration?: number;
  error?: string;
  retryCount?: number;
}

export async function updateResult(
  id: string,
  teamId: string | undefined,
  data: UpdateResultData,
): Promise<TestResult | null> {
  const result = await prisma.testResult.findUnique({
    where: { id },
    include: { testRun: { select: { teamId: true } } },
  });

  if (!result || result.testRun.teamId !== teamId) return null;

  return prisma.testResult.update({
    where: { id },
    data: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.duration !== undefined ? { duration: data.duration } : {}),
      ...(data.error !== undefined ? { error: data.error } : {}),
      ...(data.retryCount !== undefined ? { retryCount: data.retryCount } : {}),
    },
  });
}
