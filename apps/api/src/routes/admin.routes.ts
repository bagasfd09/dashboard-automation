import type { FastifyInstance } from 'fastify';
import { prisma } from '@qc-monitor/db';
import {
  requireAuth,
  requirePermission,
  requireTeamAccess,
  PERMISSIONS,
} from '../middleware/permission.middleware.js';
import { resolveTeamScope, canUserAccessTeam } from '../helpers/data-scope.js';
import * as adminService from '../services/adminService.js';
import * as testCaseService from '../services/testCaseService.js';
import * as runService from '../services/runService.js';
import * as retryService from '../services/retryService.js';
import * as teamService from '../services/teamService.js';
import { logActivity } from '../services/auth.service.js';
import { eventService } from '../services/eventService.js';
import { usersRoutes } from './users.routes.js';
import { libraryRoutes } from './library.routes.js';
import { releaseRoutes } from './release.routes.js';
import type { TestStatus } from '@qc-monitor/db';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = requireAuth();

  // Register sub-routes
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(libraryRoutes, { prefix: '/library' });
  await fastify.register(releaseRoutes, { prefix: '/releases' });

  // ── Teams ─────────────────────────────────────────────────────────────────

  /** GET /api/admin/teams */
  fastify.get('/teams', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const scope = await resolveTeamScope(user);
    const teamIds = scope?.scopeTeamIds;
    try {
      const teams = await adminService.listTeamsWithStats(teamIds);
      return reply.send(teams);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/teams — ADMIN only */
  fastify.post(
    '/teams',
    { preHandler: [auth, requirePermission('canCreateTeams')] },
    async (request, reply) => {
      const { name } = request.body as { name: string };
      if (!name?.trim()) {
        return reply.code(400).send({ error: 'Team name is required', statusCode: 400 });
      }
      try {
        const team = await teamService.createTeam(name.trim());
        await logActivity(request.user!.id, 'team.created', team.id, { name: team.name });
        return reply.code(201).send(team);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Unique constraint')) {
          return reply.code(409).send({ error: 'Team name already exists', statusCode: 409 });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** PATCH /api/admin/teams/:id — ADMIN (any), TEAM_LEAD (own team) */
  fastify.patch('/teams/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { name } = request.body as { name?: string };

    const perms = PERMISSIONS[user.role];
    if (!perms.canManageAllTeams) {
      // TEAM_LEAD can only edit own team
      if (user.role !== 'TEAM_LEAD') {
        return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
      }
      if (!(await canUserAccessTeam(user, id))) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }
    }

    try {
      const team = await teamService.updateTeam(id, { name });
      if (!team) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });
      await logActivity(user.id, 'team.updated', id, { name });
      return reply.send(team);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/teams/:id — ADMIN only */
  fastify.delete(
    '/teams/:id',
    { preHandler: [auth, requirePermission('canDeleteTeams')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const deleted = await teamService.deleteTeam(id);
        if (!deleted) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });
        await logActivity(request.user!.id, 'team.deleted', id);
        return reply.send({ message: 'Team deleted' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/teams/:teamId/stats */
  fastify.get(
    '/teams/:teamId/stats',
    { preHandler: [auth, requireTeamAccess('teamId')] },
    async (request, reply) => {
      const { teamId } = request.params as { teamId: string };
      try {
        const stats = await adminService.getTeamDetailStats(teamId);
        if (!stats) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });
        return reply.send(stats);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Team members ──────────────────────────────────────────────────────────

  /** POST /api/admin/teams/:teamId/members */
  fastify.post('/teams/:teamId/members', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { teamId } = request.params as { teamId: string };
    const { userId } = request.body as { userId: string };

    if (!userId) {
      return reply.code(400).send({ error: 'userId is required', statusCode: 400 });
    }

    const perms = PERMISSIONS[user.role];
    if (!perms.canManageAllTeams) {
      if (user.role !== 'TEAM_LEAD') {
        return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
      }
      if (!(await canUserAccessTeam(user, teamId))) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }
      // TEAM_LEAD can only add MEMBER or MONITORING
      const target = await prisma.user.findUnique({ where: { id: userId } });
      if (!target || !['MEMBER', 'MONITORING'].includes(target.role)) {
        return reply
          .code(403)
          .send({ error: 'TEAM_LEAD can only add MEMBER or MONITORING users', statusCode: 403 });
      }
    }

    try {
      const member = await prisma.teamMember.create({
        data: { userId, teamId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      await logActivity(user.id, 'team.member_added', teamId, { userId });
      return reply.code(201).send(member);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Unique constraint')) {
        return reply.code(409).send({ error: 'User is already a member', statusCode: 409 });
      }
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/teams/:teamId/members/:userId */
  fastify.delete(
    '/teams/:teamId/members/:userId',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { teamId, userId } = request.params as { teamId: string; userId: string };

      const perms = PERMISSIONS[user.role];
      if (!perms.canManageAllTeams) {
        if (user.role !== 'TEAM_LEAD') {
          return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
        }
        if (!(await canUserAccessTeam(user, teamId))) {
          return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
        }
        if (userId === user.id) {
          return reply.code(400).send({ error: 'Cannot remove yourself', statusCode: 400 });
        }
      }

      try {
        await prisma.teamMember.delete({
          where: { userId_teamId: { userId, teamId } },
        });
        await logActivity(user.id, 'team.member_removed', teamId, { userId });
        return reply.send({ message: 'Member removed' });
      } catch {
        return reply.code(404).send({ error: 'Member not found', statusCode: 404 });
      }
    },
  );

  // ── API Keys ──────────────────────────────────────────────────────────────

  /** GET /api/admin/teams/:teamId/api-keys */
  fastify.get(
    '/teams/:teamId/api-keys',
    { preHandler: [auth, requireTeamAccess('teamId')] },
    async (request, reply) => {
      const user = request.user!;
      const { teamId } = request.params as { teamId: string };
      try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });

        const showFull = user.role === 'ADMIN';
        const maskedKey = `${'•'.repeat(team.apiKey.length - 8)}${team.apiKey.slice(-8)}`;

        return reply.send({
          keys: [
            {
              id: team.id,
              ...(showFull ? { key: team.apiKey } : { maskedKey }),
              lastUsedAt: null,
              createdAt: team.createdAt,
            },
          ],
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** POST /api/admin/teams/:teamId/api-keys/rotate */
  fastify.post(
    '/teams/:teamId/api-keys/rotate',
    { preHandler: [auth, requirePermission('canManageApiKeys'), requireTeamAccess('teamId')] },
    async (request, reply) => {
      const { teamId } = request.params as { teamId: string };
      try {
        const team = await teamService.rotateApiKey(teamId);
        if (!team) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });
        await logActivity(request.user!.id, 'apikey.rotated', teamId);
        return reply.send({ message: 'API key rotated', newKey: team.apiKey });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** DELETE /api/admin/teams/:teamId/api-keys/:keyId — ADMIN only */
  fastify.delete(
    '/teams/:teamId/api-keys/:keyId',
    { preHandler: [auth, requirePermission('canRevokeApiKeys')] },
    async (request, reply) => {
      const { teamId } = request.params as { teamId: string };
      try {
        // Revoke = rotate to a new random key (invalidate old one)
        const team = await teamService.rotateApiKey(teamId);
        if (!team) return reply.code(404).send({ error: 'Team not found', statusCode: 404 });
        await logActivity(request.user!.id, 'apikey.revoked', teamId);
        return reply.send({ message: 'API key revoked' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Overview ──────────────────────────────────────────────────────────────

  /** GET /api/admin/overview */
  fastify.get('/overview', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const scope = await resolveTeamScope(user);
    try {
      const overview = await adminService.getOverview(scope?.scopeTeamIds);
      return reply.send(overview);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Test Cases ────────────────────────────────────────────────────────────

  /** GET /api/admin/test-cases */
  fastify.get(
    '/test-cases',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            tag: { type: 'string' },
            search: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            groupBy: { type: 'string', enum: ['suite', 'filePath', 'tag', 'team'] },
            innerPageSize: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const q = request.query as {
        teamId?: string;
        status?: TestStatus;
        tag?: string;
        search?: string;
        page?: number;
        pageSize?: number;
        groupBy?: 'suite' | 'filePath' | 'tag' | 'team';
        innerPageSize?: number;
      };

      const scope = await resolveTeamScope(user, q.teamId);
      if (scope === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const result = await testCaseService.listTestCases(scope.teamId, {
          status: q.status,
          tag: q.tag,
          search: q.search,
          page: q.page,
          pageSize: q.pageSize,
          groupBy: q.groupBy,
          innerPageSize: q.groupBy === 'suite' ? (q.innerPageSize ?? 5) : undefined,
          scopeTeamIds: scope.scopeTeamIds,
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/test-cases/by-suite */
  fastify.get(
    '/test-cases/by-suite',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          required: ['suiteName'],
          properties: {
            suiteName: { type: 'string' },
            teamId: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
            search: { type: 'string' },
            tag: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const q = request.query as {
        suiteName: string;
        teamId?: string;
        page?: number;
        pageSize?: number;
        search?: string;
        tag?: string;
      };

      const scope = await resolveTeamScope(user, q.teamId);
      if (scope === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const result = await testCaseService.listTestCasesBySuite(
          q.suiteName,
          scope.teamId,
          q.page ?? 1,
          q.pageSize ?? 5,
          { search: q.search, tag: q.tag, scopeTeamIds: scope.scopeTeamIds },
        );
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/test-cases/:id */
  fastify.get(
    '/test-cases/:id',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      try {
        const testCase = await testCaseService.getTestCase(id, undefined);
        if (!testCase) return reply.code(404).send({ error: 'Test case not found', statusCode: 404 });
        if (!(await canUserAccessTeam(user, testCase.teamId))) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
        return reply.send(testCase);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Runs ──────────────────────────────────────────────────────────────────

  /** GET /api/admin/runs */
  fastify.get(
    '/runs',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { teamId, page, pageSize } = request.query as {
        teamId?: string;
        page?: number;
        pageSize?: number;
      };

      const scope = await resolveTeamScope(user, teamId);
      if (scope === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const result = await runService.listRuns(scope.teamId, page, pageSize, scope.scopeTeamIds);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/runs/:id */
  fastify.get(
    '/runs/:id',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            search: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const q = request.query as { page?: number; pageSize?: number; status?: string; search?: string };

      try {
        const runMeta = await prisma.testRun.findUnique({ where: { id }, select: { teamId: true } });
        if (!runMeta) return reply.code(404).send({ error: 'Run not found', statusCode: 404 });
        if (!(await canUserAccessTeam(user, runMeta.teamId))) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
        const run = await runService.getPaginatedRun(id, undefined, {
          page: q.page,
          pageSize: q.pageSize,
          status: q.status,
          search: q.search,
        });
        return reply.send(run);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/runs/:id/results-grouped */
  fastify.get(
    '/runs/:id/results-grouped',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            innerPageSize: { type: 'integer', minimum: 1, maximum: 100, default: 5 },
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const q = request.query as { page?: number; pageSize?: number; innerPageSize?: number; status?: string };

      try {
        const runMeta = await prisma.testRun.findUnique({ where: { id }, select: { teamId: true } });
        if (!runMeta) return reply.code(404).send({ error: 'Run not found', statusCode: 404 });
        if (!(await canUserAccessTeam(user, runMeta.teamId))) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
        const result = await runService.getRunResultsGrouped(id, undefined, {
          page: q.page,
          pageSize: q.pageSize,
          innerPageSize: q.innerPageSize,
          status: q.status,
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Retries ───────────────────────────────────────────────────────────────

  /** POST /api/admin/retry */
  fastify.post(
    '/retry',
    { preHandler: [auth, requirePermission('canTriggerRetry')] },
    async (request, reply) => {
      const user = request.user!;
      const { testCaseId, teamId } = request.body as { testCaseId: string; teamId: string };

      if (!(await canUserAccessTeam(user, teamId))) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const retry = await retryService.createRetryRequest(teamId, testCaseId);
        eventService.broadcast(teamId, 'retry:requested', { id: retry.id, testCaseId, teamId });
        await logActivity(user.id, 'retry.triggered', teamId, { testCaseId });
        return reply.code(201).send(retry);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/retries */
  fastify.get(
    '/retries',
    {
      preHandler: auth,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { teamId, page, pageSize } = request.query as {
        teamId?: string;
        page?: number;
        pageSize?: number;
      };

      const scope = await resolveTeamScope(user, teamId);
      if (scope === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const result = await retryService.listRetries({ teamId: scope.teamId, page, pageSize });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Artifacts ─────────────────────────────────────────────────────────────

  /** GET /api/admin/artifacts/:id/download */
  fastify.get(
    '/artifacts/:id/download',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      try {
        const artifact = await prisma.artifact.findUnique({
          where: { id },
          include: { testResult: { include: { testRun: { select: { teamId: true } } } } },
        });
        if (!artifact) return reply.code(404).send({ error: 'Artifact not found', statusCode: 404 });
        if (!(await canUserAccessTeam(user, artifact.testResult.testRun.teamId))) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
        const url = await adminService.getAdminArtifactDownloadUrl(id, fastify.minio);
        if (!url) return reply.code(404).send({ error: 'Artifact not found', statusCode: 404 });
        return reply.redirect(url);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Activity Log ──────────────────────────────────────────────────────────

  /** GET /api/admin/activity-log */
  fastify.get(
    '/activity-log',
    { preHandler: [auth, requirePermission('canViewActivityLog')] },
    async (request, reply) => {
      const user = request.user!;
      const q = request.query as {
        teamId?: string;
        userId?: string;
        action?: string;
        from?: string;
        to?: string;
        page?: number;
        pageSize?: number;
      };

      const scope = await resolveTeamScope(user, q.teamId);
      if (scope === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }

      try {
        const result = await adminService.listActivityLog({
          teamId: scope.teamId,
          scopeTeamIds: scope.scopeTeamIds,
          userId: q.userId,
          action: q.action,
          from: q.from,
          to: q.to,
          page: q.page,
          pageSize: q.pageSize,
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
