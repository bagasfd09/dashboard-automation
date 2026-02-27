import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../middleware/permission.middleware.js';
import * as libraryService from '../services/library.service.js';
import * as matcherService from '../services/library-matcher.service.js';
import type {
  TestPriority,
  TestDifficulty,
  LibraryTestCaseStatus,
  SuggestionType,
  SuggestionStatus,
} from '@qc-monitor/db';

export async function libraryRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = requireAuth();
  const authWrite = [auth, requirePermission('canManageLibrary')];

  // ── Collections ─────────────────────────────────────────────────────────────

  /** GET /api/admin/library/collections */
  fastify.get('/collections', { preHandler: auth }, async (request, reply) => {
    const { teamId } = request.query as { teamId?: string };
    try {
      const collections = await libraryService.listCollections(teamId);
      return reply.send(collections);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/library/collections */
  fastify.post('/collections', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const { name, description, icon, teamId } = request.body as {
      name: string;
      description?: string;
      icon?: string;
      teamId?: string;
    };
    if (!name?.trim()) {
      return reply.code(400).send({ error: 'Name is required', statusCode: 400 });
    }
    try {
      const collection = await libraryService.createCollection({
        name: name.trim(),
        description,
        icon,
        teamId,
        createdById: user.id,
      });
      return reply.code(201).send(collection);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/library/collections/:id */
  fastify.patch('/collections/:id', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { name, description, icon } = request.body as {
      name?: string;
      description?: string;
      icon?: string;
    };
    try {
      const updated = await libraryService.updateCollection(id, { name, description, icon });
      if (!updated) return reply.code(404).send({ error: 'Collection not found', statusCode: 404 });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/library/collections/:id */
  fastify.delete('/collections/:id', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await libraryService.deleteCollection(id);
      if (!deleted) return reply.code(404).send({ error: 'Collection not found', statusCode: 404 });
      return reply.send({ message: 'Collection deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Coverage ─────────────────────────────────────────────────────────────────

  /** GET /api/admin/library/coverage */
  fastify.get('/coverage', { preHandler: auth }, async (request, reply) => {
    const { collectionId } = request.query as { collectionId?: string };
    try {
      const stats = await libraryService.getCoverageStats(collectionId);
      return reply.send(stats);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/library/gaps */
  fastify.get('/gaps', { preHandler: auth }, async (request, reply) => {
    const { olderThanDays } = request.query as { olderThanDays?: string };
    try {
      const gaps = await matcherService.getCoverageGaps(
        olderThanDays !== undefined ? Number(olderThanDays) : 7,
      );
      return reply.send(gaps);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/library/auto-match */
  fastify.post('/auto-match', { preHandler: authWrite }, async (_request, reply) => {
    try {
      const result = await matcherService.autoMatchLibraryTestCases();
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── My bookmarks ─────────────────────────────────────────────────────────────

  /** GET /api/admin/library/bookmarks */
  fastify.get('/bookmarks', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    try {
      const result = await libraryService.listBookmarks(user.id, page, pageSize);
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Suggestion review ────────────────────────────────────────────────────────

  /** GET /api/admin/library/suggestions — global list */
  fastify.get('/suggestions', { preHandler: auth }, async (request, reply) => {
    const { status, page, pageSize } = request.query as {
      status?: SuggestionStatus;
      page?: string;
      pageSize?: string;
    };
    try {
      const result = await libraryService.listAllSuggestions({
        status,
        page: page !== undefined ? Number(page) : undefined,
        pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      });
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/library/suggestions/:id */
  fastify.patch('/suggestions/:id', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: SuggestionStatus };
    if (!status) {
      return reply.code(400).send({ error: 'status is required', statusCode: 400 });
    }
    try {
      const updated = await libraryService.reviewSuggestion(id, status, user.id);
      if (!updated) return reply.code(404).send({ error: 'Suggestion not found', statusCode: 404 });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Discussion update/delete ──────────────────────────────────────────────────

  /** PATCH /api/admin/library/discussions/:id */
  fastify.patch('/discussions/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    if (!content?.trim()) {
      return reply.code(400).send({ error: 'Content is required', statusCode: 400 });
    }
    try {
      const updated = await libraryService.updateDiscussion(id, content, user.id);
      if (!updated) {
        return reply.code(404).send({ error: 'Discussion not found or not yours', statusCode: 404 });
      }
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/library/discussions/:id */
  fastify.delete('/discussions/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    try {
      const deleted = await libraryService.deleteDiscussion(id, user.id);
      if (!deleted) {
        return reply.code(404).send({ error: 'Discussion not found or not yours', statusCode: 404 });
      }
      return reply.send({ message: 'Discussion deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Library test cases ───────────────────────────────────────────────────────

  /** GET /api/admin/library/test-cases */
  fastify.get('/test-cases', { preHandler: auth }, async (request, reply) => {
    const q = request.query as {
      collectionId?: string;
      status?: LibraryTestCaseStatus;
      priority?: TestPriority;
      search?: string;
      tags?: string;
      page?: string;
      pageSize?: string;
    };
    try {
      const result = await libraryService.listLibraryTestCases({
        collectionId: q.collectionId,
        status: q.status,
        priority: q.priority,
        search: q.search,
        tags: q.tags ? q.tags.split(',').map((t) => t.trim()) : undefined,
        page: q.page !== undefined ? Number(q.page) : undefined,
        pageSize: q.pageSize !== undefined ? Number(q.pageSize) : undefined,
      });
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** GET /api/admin/library/test-cases/:id */
  fastify.get('/test-cases/:id', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const ltc = await libraryService.getLibraryTestCase(id);
      if (!ltc) return reply.code(404).send({ error: 'Library test case not found', statusCode: 404 });
      return reply.send(ltc);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/library/test-cases */
  fastify.post('/test-cases', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as {
      title: string;
      description?: string;
      priority?: TestPriority;
      difficulty?: TestDifficulty;
      collectionId?: string;
      tags?: string[];
      steps?: string;
      preconditions?: string;
      expectedOutcome?: string;
    };
    if (!body.title?.trim()) {
      return reply.code(400).send({ error: 'Title is required', statusCode: 400 });
    }
    try {
      const ltc = await libraryService.createLibraryTestCase({
        ...body,
        title: body.title.trim(),
        createdById: user.id,
      });
      return reply.code(201).send(ltc);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/admin/library/test-cases/:id */
  fastify.patch('/test-cases/:id', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = request.body as {
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
    };
    try {
      const updated = await libraryService.updateLibraryTestCase(id, {
        ...body,
        updatedById: user.id,
      });
      if (!updated) return reply.code(404).send({ error: 'Library test case not found', statusCode: 404 });
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/library/test-cases/:id */
  fastify.delete('/test-cases/:id', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const deleted = await libraryService.deleteLibraryTestCase(id);
      if (!deleted) return reply.code(404).send({ error: 'Library test case not found', statusCode: 404 });
      return reply.send({ message: 'Library test case deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Versions ──────────────────────────────────────────────────────────────────

  /** GET /api/admin/library/test-cases/:id/versions */
  fastify.get('/test-cases/:id/versions', { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page, pageSize } = request.query as { page?: string; pageSize?: string };
    try {
      const result = await libraryService.listVersions(id, page, pageSize);
      return reply.send(result);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** POST /api/admin/library/test-cases/:id/rollback */
  fastify.post('/test-cases/:id/rollback', { preHandler: authWrite }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { version } = request.body as { version: number };
    if (!version) {
      return reply.code(400).send({ error: 'version is required', statusCode: 400 });
    }
    try {
      const updated = await libraryService.rollbackToVersion(id, Number(version), user.id);
      if (!updated) {
        return reply.code(404).send({ error: 'Version not found', statusCode: 404 });
      }
      return reply.send(updated);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── Links ─────────────────────────────────────────────────────────────────────

  /** POST /api/admin/library/test-cases/:id/link */
  fastify.post('/test-cases/:id/link', { preHandler: authWrite }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { testCaseId } = request.body as { testCaseId: string };
    if (!testCaseId) {
      return reply.code(400).send({ error: 'testCaseId is required', statusCode: 400 });
    }
    try {
      const link = await libraryService.linkTestCase(id, testCaseId, false);
      return reply.code(201).send(link);
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** DELETE /api/admin/library/test-cases/:id/link/:testCaseId */
  fastify.delete(
    '/test-cases/:id/link/:testCaseId',
    { preHandler: authWrite },
    async (request, reply) => {
      const { id, testCaseId } = request.params as { id: string; testCaseId: string };
      try {
        const deleted = await libraryService.unlinkTestCase(id, testCaseId);
        if (!deleted) return reply.code(404).send({ error: 'Link not found', statusCode: 404 });
        return reply.send({ message: 'Link removed' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Suggestions ───────────────────────────────────────────────────────────────

  /** GET /api/admin/library/test-cases/:id/suggestions */
  fastify.get(
    '/test-cases/:id/suggestions',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, page, pageSize } = request.query as {
        status?: SuggestionStatus;
        page?: string;
        pageSize?: string;
      };
      try {
        const result = await libraryService.listSuggestions(id, {
          status,
          page: page !== undefined ? Number(page) : undefined,
          pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
        });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** POST /api/admin/library/test-cases/:id/suggestions */
  fastify.post(
    '/test-cases/:id/suggestions',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { type, content } = request.body as { type: SuggestionType; content: string };
      if (!type || !content?.trim()) {
        return reply.code(400).send({ error: 'type and content are required', statusCode: 400 });
      }
      try {
        const suggestion = await libraryService.createSuggestion({
          libraryTestCaseId: id,
          type,
          content: content.trim(),
          createdById: user.id,
        });
        return reply.code(201).send(suggestion);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Discussions ───────────────────────────────────────────────────────────────

  /** GET /api/admin/library/test-cases/:id/discussions */
  fastify.get(
    '/test-cases/:id/discussions',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page, pageSize } = request.query as { page?: string; pageSize?: string };
      try {
        const result = await libraryService.listDiscussions(id, page, pageSize);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** POST /api/admin/library/test-cases/:id/discussions */
  fastify.post(
    '/test-cases/:id/discussions',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };
      if (!content?.trim()) {
        return reply.code(400).send({ error: 'Content is required', statusCode: 400 });
      }
      try {
        const entry = await libraryService.addDiscussion({
          libraryTestCaseId: id,
          content: content.trim(),
          createdById: user.id,
        });
        return reply.code(201).send(entry);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Bookmark toggle ───────────────────────────────────────────────────────────

  /** POST /api/admin/library/test-cases/:id/bookmark */
  fastify.post(
    '/test-cases/:id/bookmark',
    { preHandler: auth },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      try {
        const result = await libraryService.toggleBookmark(id, user.id);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── Dependencies ──────────────────────────────────────────────────────────────

  /** POST /api/admin/library/test-cases/:id/dependencies */
  fastify.post(
    '/test-cases/:id/dependencies',
    { preHandler: authWrite },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { dependsOnId } = request.body as { dependsOnId: string };
      if (!dependsOnId) {
        return reply.code(400).send({ error: 'dependsOnId is required', statusCode: 400 });
      }
      try {
        const dep = await libraryService.addDependency(id, dependsOnId);
        return reply.code(201).send(dep);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('cannot depend on itself')) {
          return reply.code(400).send({ error: msg, statusCode: 400 });
        }
        if (msg.includes('Unique constraint')) {
          return reply.code(409).send({ error: 'Dependency already exists', statusCode: 409 });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  /** DELETE /api/admin/library/test-cases/:id/dependencies/:dependsOnId */
  fastify.delete(
    '/test-cases/:id/dependencies/:dependsOnId',
    { preHandler: authWrite },
    async (request, reply) => {
      const { id, dependsOnId } = request.params as { id: string; dependsOnId: string };
      try {
        const deleted = await libraryService.removeDependency(id, dependsOnId);
        if (!deleted) return reply.code(404).send({ error: 'Dependency not found', statusCode: 404 });
        return reply.send({ message: 'Dependency removed' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
