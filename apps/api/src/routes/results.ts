import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import * as resultService from '../services/resultService.js';
import type { TestStatus } from '@qc-monitor/db';

export async function resultRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['testRunId', 'testCaseId', 'status'],
          properties: {
            testRunId: { type: 'string' },
            testCaseId: { type: 'string' },
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            duration: { type: 'integer', minimum: 0 },
            error: { type: 'string' },
            retryCount: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        testRunId: string;
        testCaseId: string;
        status: TestStatus;
        duration?: number;
        error?: string;
        retryCount?: number;
      };
      try {        
        const result = await resultService.createResult(body, request.team!.id);
        return reply.code(201).send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  fastify.patch(
    '/:id',
    {
      preHandler: authenticate,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PASSED', 'FAILED', 'SKIPPED', 'RETRIED'] },
            duration: { type: 'integer', minimum: 0 },
            error: { type: 'string' },
            retryCount: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        status?: TestStatus;
        duration?: number;
        error?: string;
        retryCount?: number;
      };
      try {
        const result = await resultService.updateResult(id, request.team?.id, body);
        if (!result) return reply.code(404).send({ error: 'Result not found', statusCode: 404 });
        return reply.send(result);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
