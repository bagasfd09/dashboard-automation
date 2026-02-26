import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import * as testCaseService from '../services/testCaseService.js';
import type { TestStatus } from '@qc-monitor/db';

export async function testCaseRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            tag: { type: 'string' },
            search: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        status?: TestStatus;
        tag?: string;
        search?: string;
        page?: number;
        limit?: number;
      };
      try {
        const result = await testCaseService.listTestCases(request.team?.id, q);
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: authenticate,
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
        const testCase = await testCaseService.getTestCase(id, request.team?.id);
        if (!testCase) {
          return reply.code(404).send({ error: 'Test case not found', statusCode: 404 });
        }
        return reply.send(testCase);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  fastify.post(
    '/sync',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['testCases'],
          properties: {
            testCases: {
              type: 'array',
              items: {
                type: 'object',
                required: ['title', 'filePath'],
                properties: {
                  title: { type: 'string', minLength: 1 },
                  filePath: { type: 'string', minLength: 1 },
                  tags: { type: 'array', items: { type: 'string' } },
                  suiteName: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.team) return reply.code(401).send({ error: 'API key required', statusCode: 401 });
      const { testCases } = request.body as {
        testCases: { title: string; filePath: string; tags?: string[]; suiteName?: string }[];
      };
      try {
        const synced = await testCaseService.syncTestCases(request.team.id, testCases);
        return reply.send({ synced: synced.length, items: synced });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
