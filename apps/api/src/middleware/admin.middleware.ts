import type { FastifyRequest, FastifyReply } from 'fastify';

export async function adminAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const secret = process.env.ADMIN_SECRET_KEY;

  if (!secret) {
    return reply.code(503).send({ error: 'Admin access not configured', statusCode: 503 });
  }

  const key = request.headers['x-admin-key'];

  if (!key || typeof key !== 'string' || key !== secret) {
    return reply.code(401).send({ error: 'Invalid or missing admin key', statusCode: 401 });
  }

  request.isAdmin = true;
}
