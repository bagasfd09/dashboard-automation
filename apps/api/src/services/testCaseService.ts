import { prisma } from '@qc-monitor/db';
import type { TestCase, TestStatus } from '@qc-monitor/db';

interface ListFilters {
  status?: TestStatus;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

type TestCaseWithTeam = TestCase & { team: { id: string; name: string } };

export async function listTestCases(
  teamId: string | undefined,
  filters: ListFilters = {},
): Promise<PaginatedResult<TestCaseWithTeam>> {
  const { status, tag, search, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

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

  const [items, total] = await Promise.all([
    prisma.testCase.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.testCase.count({ where }),
  ]);

  return { items: items as TestCaseWithTeam[], total, page, limit };
}

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

interface SyncTestCase {
  title: string;
  filePath: string;
  tags?: string[];
}

export async function syncTestCases(teamId: string, testCases: SyncTestCase[]): Promise<TestCase[]> {
  return prisma.$transaction(
    testCases.map((tc) =>
      prisma.testCase.upsert({
        where: {
          teamId_filePath_title: { teamId, filePath: tc.filePath, title: tc.title },
        },
        create: { teamId, title: tc.title, filePath: tc.filePath, tags: tc.tags ?? [] },
        update: { tags: tc.tags ?? [] },
      }),
    ),
  );
}
