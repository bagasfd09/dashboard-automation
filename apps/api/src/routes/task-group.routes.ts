import type { FastifyInstance } from 'fastify';
import { prisma } from '@qc-monitor/db';
import type { TaskGroupStatus, TaskItemPersonalStatus } from '@qc-monitor/db';
import { requireAuth } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../middleware/permission.middleware.js';
import { resolveTeamScope, canUserAccessTeam } from '../helpers/data-scope.js';
import { logActivity } from '../services/auth.service.js';
import { eventService } from '../services/eventService.js';
import * as taskGroupService from '../services/taskGroup.service.js';

export async function taskGroupRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = requireAuth();

  // ── POST /api/admin/task-groups ───────────────────────────────────────────

  fastify.post('/', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as {
      name: string;
      userId?: string;
      teamId?: string;
      applicationId?: string;
      branch?: string;
      dueDate?: string;
      libraryTestCaseIds?: string[];
    };

    if (!body.name?.trim() || body.name.trim().length < 2) {
      return reply.code(400).send({ error: 'name must be 2-200 characters', statusCode: 400 });
    }
    if (body.name.trim().length > 200) {
      return reply.code(400).send({ error: 'name must be 2-200 characters', statusCode: 400 });
    }

    const targetUserId = body.userId ?? user.id;
    const perms = PERMISSIONS[user.role];

    // Only TEAM_LEAD+ can assign to another user
    if (targetUserId !== user.id) {
      if (user.role === 'MEMBER' || user.role === 'MONITORING') {
        return reply
          .code(403)
          .send({ error: 'Only Team Lead or higher can assign task groups', statusCode: 403 });
      }
    }

    // Resolve teamId — required for MEMBER/TEAM_LEAD (own team only)
    let resolvedTeamId = body.teamId;
    if (!resolvedTeamId) {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id },
        select: { teamId: true },
      });
      if (!membership) {
        return reply.code(400).send({ error: 'You must belong to a team', statusCode: 400 });
      }
      resolvedTeamId = membership.teamId;
    }

    if (!(await canUserAccessTeam(user, resolvedTeamId))) {
      return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
    }

    // Validate applicationId
    if (body.applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: body.applicationId },
        select: { teamId: true },
      });
      if (!app || app.teamId !== resolvedTeamId) {
        return reply.code(400).send({ error: 'Invalid applicationId', statusCode: 400 });
      }
    }

    // Validate libraryTestCaseIds
    if (body.libraryTestCaseIds?.length) {
      // Check all exist (library test cases are global, no team restriction needed)
      const count = await prisma.libraryTestCase.count({
        where: { id: { in: body.libraryTestCaseIds } },
      });
      if (count !== body.libraryTestCaseIds.length) {
        return reply.code(400).send({ error: 'Some library test case IDs are invalid', statusCode: 400 });
      }
    }

    try {
      const group = await taskGroupService.createTaskGroup({
        name: body.name.trim(),
        userId: targetUserId,
        createdById: user.id,
        teamId: resolvedTeamId,
        applicationId: body.applicationId,
        branch: body.branch?.trim(),
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        libraryTestCaseIds: body.libraryTestCaseIds,
      });

      await logActivity(user.id, 'task_group.created', resolvedTeamId, {
        groupId: group.id,
        name: group.name,
        assignedTo: targetUserId !== user.id ? targetUserId : undefined,
      });

      // Notify assigned user if different from creator
      if (targetUserId !== user.id) {
        const itemCount = body.libraryTestCaseIds?.length ?? 0;
        eventService.broadcast(resolvedTeamId, 'task:group-assigned', {
          userId: targetUserId,
          groupId: group.id,
          groupName: group.name,
          itemCount,
          assignedBy: { id: user.id, name: user.email },
        });
      }

      return reply.code(201).send(group);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/task-groups ────────────────────────────────────────────

  fastify.get('/', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const q = request.query as {
      userId?: string;
      status?: TaskGroupStatus;
      applicationId?: string;
      teamId?: string;
    };

    const perms = PERMISSIONS[user.role];

    try {
      let teamIds: string[] | undefined;
      let teamId: string | undefined;

      if (perms.dataScope === 'ALL_TEAMS') {
        // ADMIN/MANAGER/SUPERVISOR — can filter by teamId
        if (q.teamId) {
          teamId = q.teamId;
        }
      } else {
        // TEAM_LEAD/MEMBER — scoped to own teams
        const scope = await resolveTeamScope(user, q.teamId);
        if (scope === null) {
          return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
        }
        teamId = scope.teamId;
        teamIds = scope.scopeTeamIds;
      }

      // MEMBER can only see own groups
      let userId = q.userId;
      if (user.role === 'MEMBER' || user.role === 'MONITORING') {
        userId = user.id;
      }

      const groups = await taskGroupService.listTaskGroups({
        userId,
        teamId,
        teamIds,
        status: q.status ?? 'ACTIVE',
        applicationId: q.applicationId,
      });

      return reply.send(groups);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/task-groups/:id ───────────────────────────────────────

  fastify.get('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    try {
      const group = await taskGroupService.getTaskGroup(id);
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      // Access check: owner, team lead of same team, manager/admin
      const perms = PERMISSIONS[user.role];
      if (!perms.canManageAllTeams && user.role !== 'TEAM_LEAD') {
        if (group.userId !== user.id) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
      } else if (user.role === 'TEAM_LEAD') {
        if (!(await canUserAccessTeam(user, group.teamId))) {
          return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
        }
      }

      return reply.send(group);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── PUT /api/admin/task-groups/:id ───────────────────────────────────────

  fastify.put('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      branch?: string;
      dueDate?: string | null;
      status?: TaskGroupStatus;
      applicationId?: string | null;
    };

    try {
      const existing = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true, createdById: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      const isOwner = existing.userId === user.id;
      const isTeamLead =
        user.role === 'TEAM_LEAD' && (await canUserAccessTeam(user, existing.teamId));

      if (!perms.canManageAllTeams && !isOwner && !isTeamLead) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      const updated = await taskGroupService.updateTaskGroup(id, {
        name: body.name?.trim(),
        branch: body.branch?.trim(),
        dueDate: body.dueDate === null ? null : body.dueDate ? new Date(body.dueDate) : undefined,
        status: body.status,
        applicationId: body.applicationId,
      });

      await logActivity(user.id, 'task_group.updated', existing.teamId, { groupId: id });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── DELETE /api/admin/task-groups/:id ────────────────────────────────────

  fastify.delete('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    try {
      const existing = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      const isOwner = existing.userId === user.id;
      const isTeamLead =
        user.role === 'TEAM_LEAD' && (await canUserAccessTeam(user, existing.teamId));

      if (!perms.canManageAllTeams && !isOwner && !isTeamLead) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      await taskGroupService.deleteTaskGroup(id);
      await logActivity(user.id, 'task_group.deleted', existing.teamId, { groupId: id });
      return reply.send({ message: 'Task group deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── POST /api/admin/task-groups/:id/items ────────────────────────────────

  fastify.post('/:id/items', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as { libraryTestCaseIds: string[] };

    if (!body.libraryTestCaseIds?.length) {
      return reply.code(400).send({ error: 'libraryTestCaseIds is required', statusCode: 400 });
    }

    try {
      const group = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true },
      });
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      const isOwner = group.userId === user.id;
      const isTeamLead =
        user.role === 'TEAM_LEAD' && (await canUserAccessTeam(user, group.teamId));
      if (!perms.canManageAllTeams && !isOwner && !isTeamLead) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      // Validate IDs
      const count = await prisma.libraryTestCase.count({
        where: { id: { in: body.libraryTestCaseIds } },
      });
      if (count !== body.libraryTestCaseIds.length) {
        return reply.code(400).send({ error: 'Some library test case IDs are invalid', statusCode: 400 });
      }

      const result = await taskGroupService.addItemsToGroup(id, body.libraryTestCaseIds);
      return reply.code(201).send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── DELETE /api/admin/task-groups/:id/items/:itemId ──────────────────────

  fastify.delete('/:id/items/:itemId', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id, itemId } = request.params as { id: string; itemId: string };

    try {
      const group = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true },
      });
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      const isOwner = group.userId === user.id;
      const isTeamLead =
        user.role === 'TEAM_LEAD' && (await canUserAccessTeam(user, group.teamId));
      if (!perms.canManageAllTeams && !isOwner && !isTeamLead) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      await taskGroupService.removeItemFromGroup(id, itemId);
      return reply.send({ message: 'Item removed' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── PATCH /api/admin/task-groups/:id/items/:itemId ───────────────────────

  fastify.patch('/:id/items/:itemId', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id, itemId } = request.params as { id: string; itemId: string };
    const body = request.body as {
      personalStatus?: TaskItemPersonalStatus;
      skippedReason?: string | null;
      note?: string | null;
    };

    try {
      const group = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true },
      });
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      // Only owner can update item personal status
      const perms = PERMISSIONS[user.role];
      if (!perms.canManageAllTeams && group.userId !== user.id) {
        return reply.code(403).send({ error: 'Only the task group owner can update items', statusCode: 403 });
      }

      if (body.personalStatus === 'SKIPPED' && !body.skippedReason?.trim()) {
        return reply
          .code(400)
          .send({ error: 'skippedReason is required when status is SKIPPED', statusCode: 400 });
      }

      const updated = await taskGroupService.updateTaskGroupItem(id, itemId, body);

      // Check auto-complete after status update
      const completed = await taskGroupService.checkAndAutoComplete(id);
      if (completed) {
        eventService.broadcast(completed.teamId, 'task:group-completed', {
          groupId: completed.id,
          groupName: completed.name,
          userId: completed.userId,
        });
      }

      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── PATCH /api/admin/task-groups/:id/reorder ─────────────────────────────

  fastify.patch('/:id/reorder', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as { itemIds: string[] };

    if (!body.itemIds?.length) {
      return reply.code(400).send({ error: 'itemIds is required', statusCode: 400 });
    }

    try {
      const group = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true },
      });
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      if (!perms.canManageAllTeams && group.userId !== user.id) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      await taskGroupService.reorderGroupItems(id, body.itemIds);
      return reply.send({ message: 'Items reordered' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/task-groups/progress ──────────────────────────────────

  fastify.get('/progress', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const q = request.query as {
      teamId?: string;
      applicationId?: string;
      status?: TaskGroupStatus;
    };

    const perms = PERMISSIONS[user.role];
    // Only TEAM_LEAD+ can view team progress
    if (user.role === 'MEMBER' || user.role === 'MONITORING') {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      let teamId: string | undefined;
      let teamIds: string[] | undefined;

      if (perms.dataScope === 'ALL_TEAMS') {
        teamId = q.teamId;
      } else {
        const scope = await resolveTeamScope(user, q.teamId);
        if (scope === null) {
          return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
        }
        teamId = scope.teamId;
        teamIds = scope.scopeTeamIds;
      }

      const data = await taskGroupService.getTeamTaskProgress({
        teamId,
        teamIds,
        applicationId: q.applicationId,
        status: q.status,
      });

      return reply.send(data);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/task-groups/insights ──────────────────────────────────

  fastify.get('/insights', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const q = request.query as { teamId?: string };

    const perms = PERMISSIONS[user.role];
    if (user.role === 'MEMBER' || user.role === 'MONITORING') {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      let teamId: string | undefined;
      let teamIds: string[] | undefined;

      if (perms.dataScope === 'ALL_TEAMS') {
        teamId = q.teamId;
      } else {
        const scope = await resolveTeamScope(user, q.teamId);
        if (scope === null) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
        teamId = scope.teamId;
        teamIds = scope.scopeTeamIds;
      }

      const insights = await taskGroupService.getTaskInsights({ teamId, teamIds });
      return reply.send({ insights });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/task-groups/:id/library-picker ─────────────────────────

  fastify.get('/:id/library-picker', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const q = request.query as { applicationId?: string };

    try {
      const group = await prisma.taskGroup.findUnique({
        where: { id },
        select: { userId: true, teamId: true, applicationId: true, items: { select: { libraryTestCaseId: true } } },
      });
      if (!group) return reply.code(404).send({ error: 'Task group not found', statusCode: 404 });

      const perms = PERMISSIONS[user.role];
      const isOwner = group.userId === user.id;
      const isTeamLead = user.role === 'TEAM_LEAD' && (await canUserAccessTeam(user, group.teamId));
      if (!perms.canManageAllTeams && !isOwner && !isTeamLead) {
        return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      }

      const alreadyInGroupIds = new Set(group.items.map((i) => i.libraryTestCaseId));
      const resolvedAppId = q.applicationId ?? group.applicationId ?? undefined;

      // Get all active library test cases with their collections
      const allTestCases = await prisma.libraryTestCase.findMany({
        where: { status: { not: 'ARCHIVED' } },
        select: {
          id: true,
          title: true,
          description: true,
          priority: true,
          status: true,
          collectionId: true,
          collection: {
            select: { id: true, name: true, icon: true, applicationId: true },
          },
        },
        orderBy: [{ priority: 'asc' }, { title: 'asc' }],
      });

      // Get all other active task groups in the same team (to populate otherGroups)
      const otherGroups = await prisma.taskGroup.findMany({
        where: { teamId: group.teamId, status: 'ACTIVE', id: { not: id } },
        select: {
          id: true,
          name: true,
          items: { select: { libraryTestCaseId: true } },
        },
      });

      // Build lookup: libraryTestCaseId -> other groups that contain it
      const tcToOtherGroups = new Map<string, { id: string; name: string }[]>();
      for (const og of otherGroups) {
        for (const item of og.items) {
          const existing = tcToOtherGroups.get(item.libraryTestCaseId) ?? [];
          existing.push({ id: og.id, name: og.name });
          tcToOtherGroups.set(item.libraryTestCaseId, existing);
        }
      }

      // Build suggestions: P0 test cases not in this group, filtered by app
      const suggestions = allTestCases
        .filter((tc) => {
          if (tc.priority !== 'P0') return false;
          if (alreadyInGroupIds.has(tc.id)) return false;
          if (resolvedAppId && tc.collection) {
            return tc.collection.applicationId === resolvedAppId || tc.collection.applicationId === null;
          }
          return true;
        })
        .map((tc) => ({
          id: tc.id,
          title: tc.title,
          priority: tc.priority,
          collection: tc.collection
            ? { id: tc.collection.id, name: tc.collection.name, icon: tc.collection.icon }
            : null,
          alreadyInThisGroup: false,
        }));

      // Build collections map
      const collectionsMap = new Map<string, {
        id: string; name: string; icon: string | null; applicationId: string | null;
        testCases: typeof allTestCases[0][];
      }>();

      for (const tc of allTestCases) {
        if (!tc.collection) continue;
        const col = collectionsMap.get(tc.collectionId!);
        if (!col) {
          collectionsMap.set(tc.collectionId!, {
            id: tc.collection.id,
            name: tc.collection.name,
            icon: tc.collection.icon,
            applicationId: tc.collection.applicationId,
            testCases: [tc],
          });
        } else {
          col.testCases.push(tc);
        }
      }

      // Format collections, sort: app-matching first
      const collections = Array.from(collectionsMap.values())
        .sort((a, b) => {
          const aMatch = resolvedAppId ? a.applicationId === resolvedAppId : false;
          const bMatch = resolvedAppId ? b.applicationId === resolvedAppId : false;
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((col) => {
          const testCases = col.testCases.map((tc) => ({
            id: tc.id,
            title: tc.title,
            description: tc.description,
            priority: tc.priority,
            status: tc.status,
            alreadyInThisGroup: alreadyInGroupIds.has(tc.id),
            otherGroups: tcToOtherGroups.get(tc.id) ?? [],
          }));
          const availableCount = testCases.filter((tc) => !tc.alreadyInThisGroup).length;
          return {
            id: col.id,
            name: col.name,
            icon: col.icon,
            applicationId: col.applicationId,
            testCases,
            totalCount: testCases.length,
            availableCount,
          };
        });

      return reply.send({
        suggestions: { count: suggestions.length, items: suggestions },
        collections,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });
}
