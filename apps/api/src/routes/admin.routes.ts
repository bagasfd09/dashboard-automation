import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/admin.middleware.js';
import * as adminService from '../services/adminService.js';
import * as testCaseService from '../services/testCaseService.js';
import * as runService from '../services/runService.js';
import * as retryService from '../services/retryService.js';
import { eventService } from '../services/eventService.js';
import type { TestStatus } from '@qc-monitor/db';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes in this plugin require admin auth
  fastify.addHook('preHandler', adminAuth);

  // ── Teams overview ──────────────────────────────────────────────────────

  /** GET /api/admin/teams — list all teams with aggregated stats */
  fastify.get('/teams', async (_request, reply) => {
    try {
      const teams = await adminService.listTeamsWithStats();
      return reply.send(teams);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/teams/:teamId/stats — detailed stats for one team */
  fastify.get(
    '/teams/:teamId/stats',
    {
      schema: {
        params: {
          type: 'object',
          required: ['teamId'],
          properties: { teamId: { type: 'string' } },
        },
      },
    },
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

  // ── Dashboard overview ──────────────────────────────────────────────────

  /** GET /api/admin/overview — aggregated stats across ALL teams */
  fastify.get('/overview', async (_request, reply) => {
    try {
      const overview = await adminService.getOverview();
      return reply.send(overview);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Cross-team test cases ───────────────────────────────────────────────

  /** GET /api/admin/test-cases — list test cases from ALL teams */
  fastify.get(
    '/test-cases',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            tag: { type: 'string' },
            search: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            groupBy: { type: 'string', enum: ['suite', 'filePath', 'tag', 'team'] },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        teamId?: string;
        status?: TestStatus;
        tag?: string;
        search?: string;
        page?: number;
        limit?: number;
        groupBy?: 'suite' | 'filePath' | 'tag' | 'team';
      };
      try {
        // Pass teamId as the scoping param; undefined = all teams
        const result = await testCaseService.listTestCases(q.teamId, {
          status: q.status,
          tag: q.tag,
          search: q.search,
          page: q.page,
          limit: q.limit,
          groupBy: q.groupBy,
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/test-cases/:id — single test case, no team restriction */
  fastify.get(
    '/test-cases/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        // Pass undefined as teamId to skip team restriction
        const testCase = await testCaseService.getTestCase(id, undefined);
        if (!testCase) return reply.code(404).send({ error: 'Test case not found', statusCode: 404 });
        return reply.send(testCase);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Cross-team runs ─────────────────────────────────────────────────────

  /** GET /api/admin/runs — list runs from ALL teams (newest first) */
  fastify.get(
    '/runs',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { teamId, page, limit } = request.query as {
        teamId?: string;
        page?: number;
        limit?: number;
      };
      try {
        const result = await runService.listRuns(teamId, page, limit);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/runs/:id — run detail with results + artifacts, no team restriction */
  fastify.get(
    '/runs/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        // Pass undefined to skip team restriction
        const run = await runService.getRun(id, undefined);
        if (!run) return reply.code(404).send({ error: 'Run not found', statusCode: 404 });
        return reply.send(run);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Retry requests ──────────────────────────────────────────────────────

  /** POST /api/admin/retry — create a retry request for a failed test */
  fastify.post(
    '/retry',
    {
      schema: {
        body: {
          type: 'object',
          required: ['testCaseId', 'teamId'],
          properties: {
            testCaseId: { type: 'string' },
            teamId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { testCaseId, teamId } = request.body as { testCaseId: string; teamId: string };
      try {
        const retry = await retryService.createRetryRequest(teamId, testCaseId);
        // Broadcast event to the team's watcher
        eventService.broadcast(teamId, 'retry:requested', {
          id: retry.id,
          testCaseId,
          teamId,
        });
        return reply.code(201).send(retry);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** GET /api/admin/retries — list retry requests */
  fastify.get(
    '/retries',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { teamId, page, limit } = request.query as {
        teamId?: string;
        page?: number;
        limit?: number;
      };
      try {
        const result = await retryService.listRetries({ teamId, page, limit });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Cross-team artifacts ────────────────────────────────────────────────

  /** GET /api/admin/artifacts/:id/download — presigned URL, no team restriction */
  fastify.get(
    '/artifacts/:id/download',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const url = await adminService.getAdminArtifactDownloadUrl(id, fastify.minio);
        if (!url) return reply.code(404).send({ error: 'Artifact not found', statusCode: 404 });
        return reply.redirect(url);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
