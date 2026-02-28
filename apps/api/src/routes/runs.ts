import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import * as runService from '../services/runService.js';
import * as appService from '../services/application.service.js';
import { matchTestRunToTasks } from '../services/taskMatch.service.js';
import type { RunStatus, RunSource } from '@qc-monitor/db';

function normalizeSource(source?: string): RunSource {
  if (!source) return 'LOCAL';
  const upper = source.toUpperCase();
  if (upper === 'LOCAL' || upper === 'CI' || upper === 'MANUAL') return upper as RunSource;
  return 'LOCAL';
}

export async function runRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          properties: {
            source: { type: 'string', enum: ['local', 'ci', 'manual', 'LOCAL', 'CI', 'MANUAL'] },
            branch: { type: 'string', maxLength: 255 },
            environment: { type: 'string', maxLength: 100 },
            application: { type: 'string', maxLength: 100 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.team) return reply.code(401).send({ error: 'API key required', statusCode: 401 });
      try {
        const body = (request.body ?? {}) as {
          source?: string;
          branch?: string;
          environment?: string;
          application?: string;
        };

        let applicationId: string | null = null;
        if (body.application) {
          const app = await appService.getApplicationBySlug(request.team.id, body.application);
          if (!app) {
            // Return helpful error with available slugs
            const available = await appService.listApplications([request.team.id]);
            const slugs = available.map((a) => a.slug);
            return reply.code(422).send({
              error: `Unknown application slug "${body.application}". Available: ${slugs.length ? slugs.join(', ') : '(none registered)'}`,
              statusCode: 422,
            });
          }
          applicationId = app.id;
        }

        const run = await runService.createRun(request.team.id, {
          source: normalizeSource(body.source),
          branch: body.branch ?? null,
          environment: body.environment ?? null,
          applicationId,
        });
        return reply.code(201).send(run);
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
            status: { type: 'string', enum: ['RUNNING', 'PASSED', 'FAILED', 'CANCELLED'] },
            duration: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.team) return reply.code(401).send({ error: 'API key required', statusCode: 401 });
      const { id } = request.params as { id: string };
      const body = request.body as { status?: RunStatus; duration?: number };
      try {
        const run = await runService.updateRun(id, request.team.id, body);
        if (!run) return reply.code(404).send({ error: 'Run not found', statusCode: 404 });

        // Trigger auto-match when run completes
        if (body.status && body.status !== 'RUNNING' && body.status !== 'CANCELLED') {
          matchTestRunToTasks(run.id).catch((err) => {
            fastify.log.error({ err, runId: run.id }, 'Task auto-match failed');
          });
        }

        return reply.send(run);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  fastify.get(
    '/',
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query as { page?: number; limit?: number };
      try {
        const result = await runService.listRuns(request.team?.id, page, limit);
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
        const run = await runService.getRun(id, request.team?.id);
        if (!run) return reply.code(404).send({ error: 'Run not found', statusCode: 404 });
        return reply.send(run);
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
