import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import * as retryService from '../services/retryService.js';
import type { RetryRequestStatus } from '@qc-monitor/db';

export async function retryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authenticate);

  /** GET /api/retry/pending — fetch PENDING retries for the authenticated team */
  fastify.get('/pending', async (request, reply) => {
    try {
      const items = await retryService.getPendingRetries(request.team!.id);
      return reply.send({ items });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  /** PATCH /api/retry/:id — update retry request status */
  fastify.patch(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['PENDING', 'RUNNING', 'COMPLETED', 'EXPIRED'],
            },
            resultId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { status, resultId } = request.body as {
        status: RetryRequestStatus;
        resultId?: string;
      };
      try {
        const updated = await retryService.updateRetryRequest(id, { status, resultId });
        return reply.send(updated);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
