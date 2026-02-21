import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@qc-monitor/db';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (process.env.DISABLE_AUTH === 'true') return;

  const apiKey = request.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    return reply.code(401).send({ error: 'Missing API key', statusCode: 401 });
  }

  const team = await prisma.team.findUnique({ where: { apiKey } });

  if (!team) {
    return reply.code(401).send({ error: 'Invalid API key', statusCode: 401 });
  }

  request.team = team;
}
