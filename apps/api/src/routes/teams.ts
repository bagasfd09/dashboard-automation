import type { FastifyInstance } from 'fastify';
import * as teamService from '../services/teamService.js';

export async function teamRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { name } = request.body as { name: string };
      try {
        const team = await teamService.createTeam(name);
        return reply.code(201).send(team);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Unique constraint violation (duplicate name)
        if (message.includes('Unique constraint')) {
          return reply.code(409).send({ error: 'Team name already exists', statusCode: 409 });
        }
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );
}
