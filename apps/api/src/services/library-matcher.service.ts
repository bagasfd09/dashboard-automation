import { prisma } from '@qc-monitor/db';
import { linkTestCase } from './library.service.js';

/**
 * Scans ACTIVE library test cases without a linked TestCase and attempts to
 * match by exact title (case-insensitive) across all teams.
 * Returns counts of newly matched cases and unmatched gaps older than 7 days.
 */
export async function autoMatchLibraryTestCases(): Promise<{
  matched: number;
  gaps: number;
}> {
  const activeLibraryTestCases = await prisma.libraryTestCase.findMany({
    where: { status: 'ACTIVE' },
    include: { linkedTestCases: { select: { testCaseId: true } } },
  });

  let matched = 0;
  let gaps = 0;

  for (const ltc of activeLibraryTestCases) {
    const linkedIds = new Set(ltc.linkedTestCases.map((l) => l.testCaseId));

    const candidates = await prisma.testCase.findMany({
      where: {
        title: { equals: ltc.title, mode: 'insensitive' },
        id: { notIn: Array.from(linkedIds) },
      },
      select: { id: true },
    });

    for (const tc of candidates) {
      await linkTestCase(ltc.id, tc.id, true);
      matched++;
    }

    // Gap: ACTIVE with no linked test case after 7 days
    if (ltc.linkedTestCases.length === 0 && candidates.length === 0) {
      const ageMs = Date.now() - ltc.createdAt.getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) {
        gaps++;
      }
    }
  }

  return { matched, gaps };
}

/**
 * Returns ACTIVE library test cases with no linked TestCase that are older
 * than the given number of days (default 7).
 */
export async function getCoverageGaps(olderThanDays = 7): Promise<unknown[]> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  return prisma.libraryTestCase.findMany({
    where: {
      status: 'ACTIVE',
      linkedTestCases: { none: {} },
      createdAt: { lte: cutoff },
    },
    include: {
      collection: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
}
