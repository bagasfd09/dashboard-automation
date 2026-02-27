import { prisma } from '@qc-monitor/db';
import type {
  LibraryCollection,
  LibraryTestCase,
  LibraryTestCaseVersion,
  LibrarySuggestion,
  LibraryDiscussion,
  LibraryBookmark,
  LibraryTestCaseLink,
  TestPriority,
  TestDifficulty,
  LibraryTestCaseStatus,
  SuggestionType,
  SuggestionStatus,
  Prisma,
} from '@qc-monitor/db';

// ── Collections ────────────────────────────────────────────────────────────────

export async function listCollections(teamId?: string): Promise<unknown[]> {
  return prisma.libraryCollection.findMany({
    where: teamId ? { OR: [{ teamId }, { teamId: null }] } : undefined,
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { testCases: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createCollection(data: {
  name: string;
  description?: string;
  icon?: string;
  teamId?: string;
  createdById: string;
}): Promise<LibraryCollection> {
  return prisma.libraryCollection.create({ data });
}

export async function updateCollection(
  id: string,
  data: { name?: string; description?: string; icon?: string },
): Promise<LibraryCollection | null> {
  return prisma.libraryCollection.update({ where: { id }, data }).catch(() => null);
}

export async function deleteCollection(id: string): Promise<boolean> {
  try {
    await prisma.libraryCollection.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ── Library Test Cases ─────────────────────────────────────────────────────────

type LibraryTestCaseFilters = {
  collectionId?: string;
  status?: LibraryTestCaseStatus;
  priority?: TestPriority;
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
};

export async function listLibraryTestCases(filters: LibraryTestCaseFilters = {}): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;

  const where: Prisma.LibraryTestCaseWhereInput = {};
  if (filters.collectionId) where.collectionId = filters.collectionId;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.tags?.length) {
    where.tags = { hasSome: filters.tags };
  }

  const [items, totalItems] = await Promise.all([
    prisma.libraryTestCase.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        collection: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { linkedTestCases: true, bookmarks: true, discussions: true } },
      },
    }),
    prisma.libraryTestCase.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

export async function getLibraryTestCase(id: string): Promise<unknown | null> {
  return prisma.libraryTestCase.findUnique({
    where: { id },
    include: {
      collection: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
      versions: {
        orderBy: { version: 'desc' },
        take: 5,
        include: { createdBy: { select: { id: true, name: true } } },
      },
      dependencies: {
        include: { dependsOn: { select: { id: true, title: true, status: true } } },
      },
      dependents: {
        include: { libraryTestCase: { select: { id: true, title: true, status: true } } },
      },
      linkedTestCases: {
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
              filePath: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      },
      _count: { select: { bookmarks: true, discussions: true, suggestions: true } },
    },
  });
}

export async function createLibraryTestCase(data: {
  title: string;
  description?: string;
  priority?: TestPriority;
  difficulty?: TestDifficulty;
  collectionId?: string;
  tags?: string[];
  steps?: string;
  preconditions?: string;
  expectedOutcome?: string;
  createdById: string;
}): Promise<LibraryTestCase> {
  const ltc = await prisma.libraryTestCase.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority ?? 'P2',
      difficulty: data.difficulty ?? 'MEDIUM',
      collectionId: data.collectionId,
      tags: data.tags ?? [],
      steps: data.steps,
      preconditions: data.preconditions,
      expectedOutcome: data.expectedOutcome,
      createdById: data.createdById,
    },
  });

  // Create initial version
  await prisma.libraryTestCaseVersion.create({
    data: {
      libraryTestCaseId: ltc.id,
      version: 1,
      title: ltc.title,
      description: ltc.description,
      steps: ltc.steps,
      preconditions: ltc.preconditions,
      expectedOutcome: ltc.expectedOutcome,
      changeNotes: 'Initial version',
      createdById: data.createdById,
    },
  });

  return ltc;
}

export async function updateLibraryTestCase(
  id: string,
  data: {
    title?: string;
    description?: string;
    priority?: TestPriority;
    difficulty?: TestDifficulty;
    status?: LibraryTestCaseStatus;
    collectionId?: string;
    tags?: string[];
    steps?: string;
    preconditions?: string;
    expectedOutcome?: string;
    changeNotes?: string;
    updatedById: string;
  },
): Promise<LibraryTestCase | null> {
  const existing = await prisma.libraryTestCase.findUnique({ where: { id } });
  if (!existing) return null;

  const { changeNotes, updatedById, ...updateData } = data;

  const updated = await prisma.libraryTestCase.update({
    where: { id },
    data: { ...updateData, updatedById },
  });

  // Snapshot a new version if any content fields changed
  const contentChanged =
    data.title !== undefined ||
    data.description !== undefined ||
    data.steps !== undefined ||
    data.preconditions !== undefined ||
    data.expectedOutcome !== undefined;

  if (contentChanged) {
    const lastVersion = await prisma.libraryTestCaseVersion.findFirst({
      where: { libraryTestCaseId: id },
      orderBy: { version: 'desc' },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: id,
        version: (lastVersion?.version ?? 0) + 1,
        title: updated.title,
        description: updated.description,
        steps: updated.steps,
        preconditions: updated.preconditions,
        expectedOutcome: updated.expectedOutcome,
        changeNotes: changeNotes ?? null,
        createdById: updatedById,
      },
    });
  }

  return updated;
}

export async function deleteLibraryTestCase(id: string): Promise<boolean> {
  try {
    await prisma.libraryTestCase.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ── Versions ──────────────────────────────────────────────────────────────────

export async function listVersions(
  libraryTestCaseId: string,
  page: number | string = 1,
  pageSize: number | string = 10,
): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const _page = Number(page);
  const _pageSize = Number(pageSize);
  const skip = (_page - 1) * _pageSize;

  const [items, totalItems] = await Promise.all([
    prisma.libraryTestCaseVersion.findMany({
      where: { libraryTestCaseId },
      orderBy: { version: 'desc' },
      skip,
      take: _pageSize,
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.libraryTestCaseVersion.count({ where: { libraryTestCaseId } }),
  ]);

  return {
    data: items,
    pagination: {
      page: _page,
      pageSize: _pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / _pageSize) || 1,
    },
  };
}

export async function rollbackToVersion(
  libraryTestCaseId: string,
  version: number,
  updatedById: string,
): Promise<LibraryTestCase | null> {
  const v = await prisma.libraryTestCaseVersion.findUnique({
    where: { libraryTestCaseId_version: { libraryTestCaseId, version } },
  });
  if (!v) return null;

  return updateLibraryTestCase(libraryTestCaseId, {
    title: v.title,
    description: v.description ?? undefined,
    steps: v.steps ?? undefined,
    preconditions: v.preconditions ?? undefined,
    expectedOutcome: v.expectedOutcome ?? undefined,
    changeNotes: `Rolled back to version ${version}`,
    updatedById,
  });
}

// ── Links ─────────────────────────────────────────────────────────────────────

export async function linkTestCase(
  libraryTestCaseId: string,
  testCaseId: string,
  autoMatched = false,
): Promise<LibraryTestCaseLink> {
  return prisma.libraryTestCaseLink.upsert({
    where: { libraryTestCaseId_testCaseId: { libraryTestCaseId, testCaseId } },
    create: { libraryTestCaseId, testCaseId, autoMatched },
    update: {},
  });
}

export async function unlinkTestCase(
  libraryTestCaseId: string,
  testCaseId: string,
): Promise<boolean> {
  try {
    await prisma.libraryTestCaseLink.delete({
      where: { libraryTestCaseId_testCaseId: { libraryTestCaseId, testCaseId } },
    });
    return true;
  } catch {
    return false;
  }
}

// ── Coverage stats ────────────────────────────────────────────────────────────

export async function getCoverageStats(collectionId?: string): Promise<unknown> {
  const where: Prisma.LibraryTestCaseWhereInput = collectionId ? { collectionId } : {};

  const [total, linked, byStatus, byPriority] = await Promise.all([
    prisma.libraryTestCase.count({ where }),
    prisma.libraryTestCase.count({ where: { ...where, linkedTestCases: { some: {} } } }),
    prisma.libraryTestCase.groupBy({ by: ['status'], where, _count: { status: true } }),
    prisma.libraryTestCase.groupBy({ by: ['priority'], where, _count: { priority: true } }),
  ]);

  const coverage = total > 0 ? Math.round((linked / total) * 100) : 0;

  return {
    total,
    linked,
    unlinked: total - linked,
    coverage,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
    byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.priority })),
  };
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export async function listAllSuggestions(filters: {
  status?: SuggestionStatus;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;
  const where = filters.status ? { status: filters.status } : {};

  const [items, totalItems] = await Promise.all([
    prisma.librarySuggestion.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        libraryTestCase: {
          select: {
            id: true,
            title: true,
            collection: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.librarySuggestion.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

export async function listSuggestions(
  libraryTestCaseId: string,
  filters: { status?: SuggestionStatus; page?: number; pageSize?: number } = {},
): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;
  const where = {
    libraryTestCaseId,
    ...(filters.status && { status: filters.status }),
  };

  const [items, totalItems] = await Promise.all([
    prisma.librarySuggestion.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.librarySuggestion.count({ where }),
  ]);

  return {
    data: items,
    pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) || 1 },
  };
}

export async function createSuggestion(data: {
  libraryTestCaseId: string;
  type: SuggestionType;
  content: string;
  createdById: string;
}): Promise<LibrarySuggestion> {
  return prisma.librarySuggestion.create({ data });
}

export async function reviewSuggestion(
  id: string,
  status: SuggestionStatus,
  reviewedById: string,
): Promise<LibrarySuggestion | null> {
  return prisma.librarySuggestion
    .update({ where: { id }, data: { status, reviewedById, reviewedAt: new Date() } })
    .catch(() => null);
}

// ── Discussions ───────────────────────────────────────────────────────────────

export async function listDiscussions(
  libraryTestCaseId: string,
  page: number | string = 1,
  pageSize: number | string = 20,
): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const _page = Number(page);
  const _pageSize = Number(pageSize);
  const skip = (_page - 1) * _pageSize;

  const [items, totalItems] = await Promise.all([
    prisma.libraryDiscussion.findMany({
      where: { libraryTestCaseId },
      skip,
      take: _pageSize,
      orderBy: { createdAt: 'asc' },
      include: { createdBy: { select: { id: true, name: true } } },
    }),
    prisma.libraryDiscussion.count({ where: { libraryTestCaseId } }),
  ]);

  return {
    data: items,
    pagination: {
      page: _page,
      pageSize: _pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / _pageSize) || 1,
    },
  };
}

export async function addDiscussion(data: {
  libraryTestCaseId: string;
  content: string;
  createdById: string;
}): Promise<LibraryDiscussion> {
  return prisma.libraryDiscussion.create({ data });
}

export async function updateDiscussion(
  id: string,
  content: string,
  userId: string,
): Promise<LibraryDiscussion | null> {
  const entry = await prisma.libraryDiscussion.findUnique({ where: { id } });
  if (!entry || entry.createdById !== userId) return null;
  return prisma.libraryDiscussion.update({ where: { id }, data: { content } });
}

export async function deleteDiscussion(id: string, userId: string): Promise<boolean> {
  const entry = await prisma.libraryDiscussion.findUnique({ where: { id } });
  if (!entry || entry.createdById !== userId) return false;
  try {
    await prisma.libraryDiscussion.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function toggleBookmark(
  libraryTestCaseId: string,
  userId: string,
): Promise<{ bookmarked: boolean }> {
  const existing = await prisma.libraryBookmark.findUnique({
    where: { libraryTestCaseId_userId: { libraryTestCaseId, userId } },
  });

  if (existing) {
    await prisma.libraryBookmark.delete({
      where: { libraryTestCaseId_userId: { libraryTestCaseId, userId } },
    });
    return { bookmarked: false };
  }

  await prisma.libraryBookmark.create({ data: { libraryTestCaseId, userId } });
  return { bookmarked: true };
}

export async function listBookmarks(
  userId: string,
  page: number | string = 1,
  pageSize: number | string = 20,
): Promise<{
  data: unknown[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const _page = Number(page);
  const _pageSize = Number(pageSize);
  const skip = (_page - 1) * _pageSize;

  const [items, totalItems] = await Promise.all([
    prisma.libraryBookmark.findMany({
      where: { userId },
      skip,
      take: _pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        libraryTestCase: {
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            collection: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.libraryBookmark.count({ where: { userId } }),
  ]);

  return {
    data: items,
    pagination: {
      page: _page,
      pageSize: _pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / _pageSize) || 1,
    },
  };
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export async function addDependency(
  libraryTestCaseId: string,
  dependsOnId: string,
): Promise<unknown> {
  if (libraryTestCaseId === dependsOnId) {
    throw new Error('A test case cannot depend on itself');
  }
  return prisma.libraryDependency.create({ data: { libraryTestCaseId, dependsOnId } });
}

export async function removeDependency(
  libraryTestCaseId: string,
  dependsOnId: string,
): Promise<boolean> {
  try {
    await prisma.libraryDependency.delete({
      where: { libraryTestCaseId_dependsOnId: { libraryTestCaseId, dependsOnId } },
    });
    return true;
  } catch {
    return false;
  }
}
