import { prisma } from '@qc-monitor/db';
import type { TaskGroupStatus, TaskItemPersonalStatus } from '@qc-monitor/db';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Minimal shape returned from service functions — avoids Prisma internal type leakage */
export interface TaskGroupRecord {
  id: string;
  name: string;
  userId: string;
  createdById: string;
  teamId: string;
  applicationId: string | null;
  branch: string | null;
  dueDate: Date | null;
  status: TaskGroupStatus;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string };
  createdBy: { id: string; name: string };
  application: { id: string; name: string; icon: string | null } | null;
  [key: string]: unknown;
}

export interface TaskGroupProgress {
  total: number;
  localPassed: number;
  localFailed: number;
  envPassed: number;
  envFailed: number;
  skipped: number;
  notStarted: number;
  inProgress: number;
}

function computeProgress(items: Array<{
  localResultStatus: string | null;
  envResultStatus: string | null;
  personalStatus: TaskItemPersonalStatus;
}>): TaskGroupProgress {
  const progress: TaskGroupProgress = {
    total: items.length,
    localPassed: 0,
    localFailed: 0,
    envPassed: 0,
    envFailed: 0,
    skipped: 0,
    notStarted: 0,
    inProgress: 0,
  };

  for (const item of items) {
    if (item.localResultStatus === 'PASSED') progress.localPassed++;
    if (item.localResultStatus === 'FAILED') progress.localFailed++;
    if (item.envResultStatus === 'PASSED') progress.envPassed++;
    if (item.envResultStatus === 'FAILED') progress.envFailed++;
    if (item.personalStatus === 'SKIPPED') progress.skipped++;
    if (item.personalStatus === 'NOT_STARTED') progress.notStarted++;
    if (item.personalStatus === 'IN_PROGRESS') progress.inProgress++;
  }

  return progress;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createTaskGroup(data: {
  name: string;
  userId: string;
  createdById: string;
  teamId: string;
  applicationId?: string;
  branch?: string;
  dueDate?: Date;
  libraryTestCaseIds?: string[];
}): Promise<TaskGroupRecord> {
  const { libraryTestCaseIds, ...groupData } = data;

  const group = await prisma.taskGroup.create({
    data: {
      ...groupData,
      items: libraryTestCaseIds?.length
        ? {
            create: libraryTestCaseIds.map((ltcId, idx) => ({
              libraryTestCaseId: ltcId,
              order: idx,
            })),
          }
        : undefined,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      application: { select: { id: true, name: true, icon: true } },
      items: {
        include: {
          libraryTestCase: {
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
              collection: { select: { name: true } },
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  return group as unknown as TaskGroupRecord;
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listTaskGroups(filters: {
  userId?: string;
  teamId?: string;
  teamIds?: string[];
  status?: TaskGroupStatus;
  applicationId?: string;
}): Promise<TaskGroupRecord[]> {
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;
  if (filters.applicationId) where.applicationId = filters.applicationId;

  if (filters.teamId) {
    where.teamId = filters.teamId;
  } else if (filters.teamIds) {
    where.teamId = { in: filters.teamIds };
  }

  if (filters.userId) where.userId = filters.userId;

  const groups = await prisma.taskGroup.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      application: { select: { id: true, name: true, icon: true } },
      items: {
        select: {
          localResultStatus: true,
          envResultStatus: true,
          personalStatus: true,
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  return groups.map((g) => {
    const progress = computeProgress(g.items);
    const isOverdue = g.dueDate ? g.dueDate < new Date() && g.status === 'ACTIVE' : false;
    const { items, ...rest } = g;
    return { ...rest, progress, isOverdue } as unknown as TaskGroupRecord;
  });
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

export async function getTaskGroup(id: string): Promise<TaskGroupRecord | null> {
  const group = await prisma.taskGroup.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      application: { select: { id: true, name: true, icon: true } },
      items: {
        include: {
          libraryTestCase: {
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
              collection: { select: { name: true } },
            },
          },
          localTestRun: { select: { id: true, startedAt: true } },
          envTestRun: { select: { id: true, startedAt: true } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!group) return null;

  const progress = computeProgress(group.items);
  const isOverdue = group.dueDate ? group.dueDate < new Date() && group.status === 'ACTIVE' : false;

  if (!group) return null;
  return { ...group, progress, isOverdue } as unknown as TaskGroupRecord;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTaskGroup(
  id: string,
  data: {
    name?: string;
    branch?: string;
    dueDate?: Date | null;
    status?: TaskGroupStatus;
    applicationId?: string | null;
  },
): Promise<TaskGroupRecord> {
  return prisma.taskGroup.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      application: { select: { id: true, name: true, icon: true } },
    },
  }) as unknown as TaskGroupRecord;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTaskGroup(id: string): Promise<{ id: string }> {
  return prisma.taskGroup.delete({ where: { id }, select: { id: true } });
}

// ── Items: Add ────────────────────────────────────────────────────────────────

export async function addItemsToGroup(taskGroupId: string, libraryTestCaseIds: string[]) {
  // Get current max order
  const maxOrderItem = await prisma.taskGroupItem.findFirst({
    where: { taskGroupId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const startOrder = (maxOrderItem?.order ?? -1) + 1;

  // Check for duplicates
  const existing = await prisma.taskGroupItem.findMany({
    where: { taskGroupId, libraryTestCaseId: { in: libraryTestCaseIds } },
    select: { libraryTestCaseId: true },
  });
  const existingIds = new Set(existing.map((e) => e.libraryTestCaseId));
  const newIds = libraryTestCaseIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return { added: 0, duplicates: libraryTestCaseIds.length };
  }

  await prisma.taskGroupItem.createMany({
    data: newIds.map((ltcId, idx) => ({
      taskGroupId,
      libraryTestCaseId: ltcId,
      order: startOrder + idx,
    })),
  });

  return { added: newIds.length, duplicates: existingIds.size };
}

// ── Items: Remove ─────────────────────────────────────────────────────────────

export async function removeItemFromGroup(taskGroupId: string, itemId: string): Promise<{ id: string }> {
  return prisma.taskGroupItem.delete({
    where: { id: itemId, taskGroupId },
    select: { id: true },
  });
}

// ── Items: Update ─────────────────────────────────────────────────────────────

export async function updateTaskGroupItem(
  taskGroupId: string,
  itemId: string,
  data: {
    personalStatus?: TaskItemPersonalStatus;
    skippedReason?: string | null;
    note?: string | null;
  },
): Promise<Record<string, unknown>> {
  return prisma.taskGroupItem.update({
    where: { id: itemId, taskGroupId },
    data,
    include: {
      libraryTestCase: { select: { id: true, title: true, priority: true } },
    },
  }) as unknown as Record<string, unknown>;
}

// ── Items: Reorder ────────────────────────────────────────────────────────────

export async function reorderGroupItems(taskGroupId: string, itemIds: string[]) {
  await Promise.all(
    itemIds.map((id, idx) =>
      prisma.taskGroupItem.update({
        where: { id, taskGroupId },
        data: { order: idx },
      }),
    ),
  );
}

// ── Task Progress (Team Lead view) ────────────────────────────────────────────

export async function getTeamTaskProgress(filters: {
  teamId?: string;
  teamIds?: string[];
  applicationId?: string;
  status?: TaskGroupStatus;
}): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = { status: filters.status ?? 'ACTIVE' };
  if (filters.teamId) {
    where.teamId = filters.teamId;
  } else if (filters.teamIds) {
    where.teamId = { in: filters.teamIds };
  }
  if (filters.applicationId) where.applicationId = filters.applicationId;

  // Get all task groups matching filter
  const groups = await prisma.taskGroup.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      application: { select: { id: true, name: true, icon: true } },
      items: {
        select: {
          localResultStatus: true,
          envResultStatus: true,
          personalStatus: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Get all team members from the scoped teams
  const teamIdList = filters.teamId
    ? [filters.teamId]
    : (filters.teamIds ?? []);

  const members = await prisma.teamMember.findMany({
    where: {
      teamId: { in: teamIdList },
      user: { role: { in: ['MEMBER', 'TEAM_LEAD'] } },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    distinct: ['userId'],
  });

  // Group task groups by user
  const groupsByUserId = new Map<string, typeof groups>();
  for (const g of groups) {
    const existing = groupsByUserId.get(g.userId) ?? [];
    existing.push(g);
    groupsByUserId.set(g.userId, existing);
  }

  // Build per-member summaries
  const memberData = members.map((m) => {
    const memberGroups = groupsByUserId.get(m.userId) ?? [];

    const groupSummaries = memberGroups.map((g) => {
      const progress = computeProgress(g.items);
      const isOverdue = g.dueDate ? g.dueDate < new Date() && g.status === 'ACTIVE' : false;
      const lastActivity = g.items.length
        ? g.items.reduce((latest, item) =>
            item.updatedAt > latest ? item.updatedAt : latest,
            g.items[0].updatedAt,
          )
        : null;
      const { items, ...rest } = g;
      return { ...rest, progress, isOverdue, lastActivity };
    });

    const allItems = memberGroups.flatMap((g) => g.items);
    const lastActivity = allItems.length
      ? allItems.reduce((latest, item) =>
          item.updatedAt > latest ? item.updatedAt : latest,
          allItems[0].updatedAt,
        )
      : null;

    const totalItems = allItems.length;
    const completedItems = allItems.filter(
      (i) => i.localResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED',
    ).length;
    const overdueGroups = groupSummaries.filter((g) => g.isOverdue).length;

    return {
      user: m.user,
      taskGroups: groupSummaries,
      summary: {
        totalGroups: memberGroups.length,
        totalItems,
        completedItems,
        overdueGroups,
        lastActivity,
        warning: memberGroups.length === 0 ? 'NO_ACTIVE_TASKS' : undefined,
      },
    };
  });

  // Team-level summary
  const allGroups = groups;
  const allItems = allGroups.flatMap((g) => g.items);
  const localPassedCount = allItems.filter((i) => i.localResultStatus === 'PASSED').length;
  const envPassedCount = allItems.filter((i) => i.envResultStatus === 'PASSED').length;
  const overdueGroupCount = allGroups.filter(
    (g) => g.dueDate && g.dueDate < new Date() && g.status === 'ACTIVE',
  ).length;

  const localPassRate = allItems.length
    ? Math.round((localPassedCount / allItems.length) * 100)
    : 0;
  const envPassRate = allItems.length
    ? Math.round((envPassedCount / allItems.length) * 100)
    : 0;

  // Sprint readiness: all groups have all items with envResultStatus = PASSED
  const allEnvPassed = allGroups.every((g) =>
    g.items.every((i) => i.envResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED'),
  );

  const membersWithTasks = memberData.filter((m) => m.taskGroups.length > 0).length;

  return {
    members: memberData,
    teamSummary: {
      totalMembers: members.length,
      membersWithTasks,
      membersWithoutTasks: members.length - membersWithTasks,
      totalItems: allItems.length,
      localPassRate,
      envPassRate,
      overdueGroups: overdueGroupCount,
      sprintReadiness: allEnvPassed && allItems.length > 0 ? 'READY' : 'NOT_READY',
    },
  };
}

// ── Smart Insights ────────────────────────────────────────────────────────────

export interface TaskInsight {
  type: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  message: string;
  itemId?: string;
  taskGroupId?: string;
  userId?: string;
}

export async function getTaskInsights(filters: {
  teamId?: string;
  teamIds?: string[];
}): Promise<TaskInsight[]> {
  const where: Record<string, unknown> = { status: 'ACTIVE' };
  if (filters.teamId) {
    where.teamId = filters.teamId;
  } else if (filters.teamIds) {
    where.teamId = { in: filters.teamIds };
  }

  const groups = await prisma.taskGroup.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: {
          libraryTestCase: { select: { title: true } },
        },
      },
    },
  });

  const insights: TaskInsight[] = [];

  for (const group of groups) {
    // Overdue
    if (group.dueDate && group.dueDate < new Date()) {
      insights.push({
        type: 'OVERDUE',
        severity: 'error',
        message: `${group.user.name}'s "${group.name}" is overdue (was due ${group.dueDate.toLocaleDateString()})`,
        taskGroupId: group.id,
        userId: group.userId,
      });
    }

    // All env passed → release ready
    const hasItems = group.items.length > 0;
    const allEnvPassed = hasItems && group.items.every(
      (i) => i.envResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED',
    );
    if (allEnvPassed) {
      insights.push({
        type: 'RELEASE_READY',
        severity: 'success',
        message: `${group.user.name}'s "${group.name}": all tests pass on staging — release-ready ✅`,
        taskGroupId: group.id,
        userId: group.userId,
      });
    }

    for (const item of group.items) {
      // Works local, fails staging
      if (item.localResultStatus === 'PASSED' && item.envResultStatus === 'FAILED') {
        insights.push({
          type: 'WORKS_LOCAL_FAILS_STAGING',
          severity: 'warning',
          message: `"${item.libraryTestCase.title}" passes locally but fails on staging for ${group.user.name} — possible merge conflict or env issue`,
          itemId: item.id,
          taskGroupId: group.id,
          userId: group.userId,
        });
      }

      // Local passed, not yet on staging
      if (item.localResultStatus === 'PASSED' && !item.envResultStatus) {
        insights.push({
          type: 'NOT_MERGED',
          severity: 'info',
          message: `${group.user.name}'s "${item.libraryTestCase.title}" passes locally but hasn't run on staging — branch may not be merged`,
          itemId: item.id,
          taskGroupId: group.id,
          userId: group.userId,
        });
      }
    }
  }

  // Members with no active task groups
  const teamIdList = filters.teamId ? [filters.teamId] : (filters.teamIds ?? []);
  const members = await prisma.teamMember.findMany({
    where: {
      teamId: { in: teamIdList },
      user: { role: 'MEMBER' },
    },
    include: {
      user: { select: { id: true, name: true, updatedAt: true } },
    },
    distinct: ['userId'],
  });

  const activeUserIds = new Set(groups.map((g) => g.userId));
  for (const m of members) {
    if (!activeUserIds.has(m.userId)) {
      insights.push({
        type: 'NO_ACTIVE_TASKS',
        severity: 'warning',
        message: `${m.user.name} has no active task groups`,
        userId: m.userId,
      });
    }
  }

  return insights;
}

// ── Auto-complete check ───────────────────────────────────────────────────────

/**
 * Checks if all items in a task group are done (PASSED or SKIPPED).
 * If so, marks group as COMPLETED and returns the group for notification.
 */
export async function checkAndAutoComplete(taskGroupId: string): Promise<{ id: string; name: string; userId: string; teamId: string } | null> {
  const group = await prisma.taskGroup.findUnique({
    where: { id: taskGroupId },
    include: {
      items: {
        select: { localResultStatus: true, personalStatus: true },
      },
    },
  });

  if (!group || group.status !== 'ACTIVE') return null;
  if (group.items.length === 0) return null;

  const allDone = group.items.every(
    (i) => i.localResultStatus === 'PASSED' || i.personalStatus === 'SKIPPED',
  );

  if (allDone) {
    await prisma.taskGroup.update({
      where: { id: taskGroupId },
      data: { status: 'COMPLETED' },
    });
    return group;
  }

  return null;
}
