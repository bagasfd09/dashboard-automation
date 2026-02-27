import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/permission.middleware.js';
import * as releaseService from '../services/release.service.js';
import type { ReleaseStatus, ChecklistItemType, ChecklistItemStatus } from '@qc-monitor/db';

export async function releaseRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = requireAuth();
  const authWrite = [auth, requirePermission('canManageReleases')];

  // ── Releases ─────────────────────────────────────────────────────────────────

  /** GET /api/admin/releases */
  fastify.get('/', { preHandler: auth }, async (request, reply) => {
    const q = request.query as {
      teamId?: string;
      status?: ReleaseStatus;
      search?: string;
      page?: string;
      pageSize?: string;
    };
    try {
      const result = await releaseService.listReleases({
        teamId: q.teamId,
        status: q.status,
        search: q.search,
        page: q.page !== undefined ? Number(q.page) : undefined,
        pageSize: q.pageSize !== undefined ? Number(q.pageSize) : undefined,
      });
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/releases */
  fastify.post('/', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as {
      name: string;
      version: string;
      description?: string;
      teamId?: string;
      targetDate?: string;
    };
    if (!body.name?.trim() || !body.version?.trim()) {
      return reply.code(400).send({ error: 'name and version are required', statusCode: 400 });
    }
    try {
      const release = await releaseService.createRelease({
        name: body.name.trim(),
        version: body.version.trim(),
        description: body.description,
        teamId: body.teamId,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
        createdById: user.id,
      });
      return reply.code(201).send(release);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/releases/:id */
  fastify.get('/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const release = await releaseService.getRelease(id);
      if (!release) return reply.code(404).send({ error: 'Release not found', statusCode: 404 });
      return reply.send(release);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/releases/:id */
  fastify.patch('/:id', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      version?: string;
      description?: string;
      targetDate?: string | null;
      status?: ReleaseStatus;
    };
    try {
      const updated = await releaseService.updateRelease(id, {
        name: body.name,
        version: body.version,
        description: body.description,
        targetDate: body.targetDate === null ? null
          : body.targetDate ? new Date(body.targetDate)
          : undefined,
        status: body.status,
      });
      if (!updated) return reply.code(404).send({ error: 'Release not found', statusCode: 404 });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/releases/:id */
  fastify.delete('/:id', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await releaseService.deleteRelease(id);
      if (!deleted) return reply.code(404).send({ error: 'Release not found', statusCode: 404 });
      return reply.send({ message: 'Release deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/releases/:id/mark-released */
  fastify.post('/:id/mark-released', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await releaseService.markReleased(id);
      return reply.send(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('unresolved checklist items')) {
        const blockers = (err as { blockers?: unknown }).blockers;
        return reply.code(422).send({
          error: msg,
          blockers,
          statusCode: 422,
        });
      }
      if (msg.includes('Record to update not found')) {
        return reply.code(404).send({ error: 'Release not found', statusCode: 404 });
      }
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/releases/:id/cancel */
  fastify.post('/:id/cancel', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const release = await releaseService.cancelRelease(id);
      if (!release) return reply.code(404).send({ error: 'Release not found', statusCode: 404 });
      return reply.send(release);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/releases/:id/stats */
  fastify.get('/:id/stats', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const stats = await releaseService.getReleaseStats(id);
      return reply.send(stats);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Checklist items ───────────────────────────────────────────────────────────

  /** POST /api/admin/releases/:id/checklist */
  fastify.post('/:id/checklist', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      type: ChecklistItemType;
      title: string;
      description?: string;
      libraryTestCaseId?: string;
      testCaseId?: string;
      order?: number;
      assignedToId?: string;
    };
    if (!body.type || !body.title?.trim()) {
      return reply.code(400).send({ error: 'type and title are required', statusCode: 400 });
    }
    try {
      const item = await releaseService.addChecklistItem({
        releaseId: id,
        type: body.type,
        title: body.title.trim(),
        description: body.description,
        libraryTestCaseId: body.libraryTestCaseId,
        testCaseId: body.testCaseId,
        order: body.order,
        assignedToId: body.assignedToId,
      });
      return reply.code(201).send(item);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/releases/:id/checklist/:itemId */
  fastify.patch('/:id/checklist/:itemId', { preHandler: auth }, async (request, reply) => {
    const { itemId } = request.params as { id: string; itemId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      status?: ChecklistItemStatus;
      assignedToId?: string | null;
      order?: number;
      notes?: string;
    };
    try {
      const updated = await releaseService.updateChecklistItem(itemId, body);
      if (!updated) return reply.code(404).send({ error: 'Checklist item not found', statusCode: 404 });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/releases/:id/checklist/:itemId */
  fastify.delete(
    '/:id/checklist/:itemId',
    { preHandler: authWrite },
    async (request, reply) => {
      const { itemId } = request.params as { id: string; itemId: string };
      try {
        const deleted = await releaseService.deleteChecklistItem(itemId);
        if (!deleted) return reply.code(404).send({ error: 'Checklist item not found', statusCode: 404 });
        return reply.send({ message: 'Checklist item deleted' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Test run linking ──────────────────────────────────────────────────────────

  /** POST /api/admin/releases/:id/runs */
  fastify.post('/:id/runs', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { testRunId } = request.body as { testRunId: string };
    if (!testRunId) {
      return reply.code(400).send({ error: 'testRunId is required', statusCode: 400 });
    }
    try {
      const link = await releaseService.linkRunToRelease(id, testRunId);
      return reply.code(201).send(link);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/releases/:id/runs/:testRunId */
  fastify.delete('/:id/runs/:testRunId', { preHandler: authWrite }, async (request, reply) => {
    const { id, testRunId } = request.params as { id: string; testRunId: string };
    try {
      const deleted = await releaseService.unlinkRunFromRelease(id, testRunId);
      if (!deleted) return reply.code(404).send({ error: 'Link not found', statusCode: 404 });
      return reply.send({ message: 'Run unlinked from release' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });
}
