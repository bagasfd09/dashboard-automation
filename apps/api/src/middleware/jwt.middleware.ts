import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../services/auth.service.js';

export async function jwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply
      .code(401)
      .send({ error: 'Missing or invalid Authorization header', statusCode: 401 });
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token', statusCode: 401 });
  }
}
