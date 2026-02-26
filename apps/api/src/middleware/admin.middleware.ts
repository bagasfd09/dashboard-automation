import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../services/auth.service.js';

export async function adminAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const secret = process.env.ADMIN_SECRET_KEY;

  if (!secret) {
    return reply
      .code(503)
      .send({ error: 'Admin access not configured', statusCode: 503 });
  }

  const key = request.headers['x-admin-key'];

  if (!key || typeof key !== 'string' || key !== secret) {
    return reply
      .code(401)
      .send({ error: 'Invalid or missing admin key', statusCode: 401 });
  }

  request.isAdmin = true;
}

/**
 * Accepts either x-admin-key header (backwards compatible) OR Bearer JWT token.
 * Used on all /api/admin/* routes.
 */
export async function adminOrJwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 1. Try x-admin-key (backwards compatible)
  const secret = process.env.ADMIN_SECRET_KEY;
  const key = request.headers['x-admin-key'];

  if (secret && key && typeof key === 'string' && key === secret) {
    request.isAdmin = true;
    return;
  }

  // 2. Try JWT Bearer token
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = verifyAccessToken(token);
      request.user = {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      };
      request.isAdmin = true;
      return;
    } catch {
      return reply
        .code(401)
        .send({ error: 'Invalid or expired token', statusCode: 401 });
    }
  }

  return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
}
