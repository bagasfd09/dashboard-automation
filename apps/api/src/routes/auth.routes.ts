import type { FastifyInstance } from 'fastify';
import { prisma } from '@qc-monitor/db';
import { jwtAuth } from '../middleware/jwt.middleware.js';
import { PERMISSIONS } from '../middleware/permission.middleware.js';
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
import * as inviteService from '../services/invite.service.js';
import * as passwordResetService from '../services/password-reset.service.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply
        .code(400)
        .send({ error: 'Email and password are required', statusCode: 400 });
    }

    const user = await userService.getUserByEmail(email);

    if (!user || !(await authService.verifyPassword(password, user.password))) {
      return reply
        .code(401)
        .send({ error: 'Invalid email or password', statusCode: 401 });
    }

    if (!user.isActive) {
      return reply
        .code(403)
        .send({ error: 'Account is deactivated', statusCode: 403 });
    }

    const deviceInfo = request.headers['user-agent'];
    const [accessToken, refreshToken] = await Promise.all([
      authService.generateAccessToken(user),
      authService.generateRefreshToken(
        user,
        typeof deviceInfo === 'string' ? deviceInfo : undefined,
      ),
    ]);

    await Promise.all([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      authService.logActivity(user.id, 'user.login'),
    ]);

    const teams = await userService.getUserTeams(user.id);

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePass: user.mustChangePass,
        teams,
      },
    });
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const body = request.body as { refreshToken?: string } | null | undefined;
    const refreshToken =
      request.cookies['refresh_token'] ??
      (body && typeof body === 'object' ? body.refreshToken : undefined);

    if (!refreshToken) {
      return reply
        .code(401)
        .send({ error: 'No refresh token provided', statusCode: 401 });
    }

    const clearCookie = () =>
      reply.clearCookie('refresh_token', { path: '/api/auth' });

    try {
      // Validate the existing refresh token
      const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!stored || stored.expiresAt < new Date()) {
        if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
        clearCookie();
        return reply
          .code(401)
          .send({ error: 'Invalid or expired refresh token', statusCode: 401 });
      }

      if (!stored.user.isActive) {
        clearCookie();
        return reply.code(401).send({ error: 'Account is deactivated', statusCode: 401 });
      }

      // Token rotation: generate new tokens, revoke old one
      const deviceInfo = request.headers['user-agent'];
      const [accessToken, newRefreshToken] = await Promise.all([
        authService.generateAccessToken(stored.user),
        authService.generateRefreshToken(
          stored.user,
          typeof deviceInfo === 'string' ? deviceInfo : undefined,
        ),
      ]);
      await authService.revokeRefreshToken(refreshToken);

      const teams = await userService.getUserTeams(stored.user.id);

      reply.setCookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({
        accessToken,
        user: {
          id: stored.user.id,
          name: stored.user.name,
          email: stored.user.email,
          role: stored.user.role,
          mustChangePass: stored.user.mustChangePass,
          teams,
        },
      });
    } catch {
      clearCookie();
      return reply
        .code(401)
        .send({ error: 'Invalid or expired refresh token', statusCode: 401 });
    }
  });

  // POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    const refreshToken = request.cookies['refresh_token'];

    if (refreshToken) {
      // Best-effort: log activity before revoking
      try {
        const stored = await prisma.refreshToken.findUnique({
          where: { token: refreshToken },
        });
        if (stored) {
          await authService.logActivity(stored.userId, 'user.logout');
        }
      } catch {
        // ignore
      }
      await authService.revokeRefreshToken(refreshToken);
    }

    reply.clearCookie('refresh_token', { path: '/api/auth' });
    return reply.send({ message: 'Logged out successfully' });
  });

  // POST /api/auth/accept-invite
  fastify.post('/accept-invite', async (request, reply) => {
    const { token, name, password } = request.body as {
      token: string;
      name: string;
      password: string;
    };

    if (!token || !name || !password) {
      return reply
        .code(400)
        .send({ error: 'token, name, and password are required', statusCode: 400 });
    }

    try {
      const user = await inviteService.acceptInvite(token, password, name);

      const deviceInfo = request.headers['user-agent'];
      const [accessToken, refreshToken] = await Promise.all([
        authService.generateAccessToken(user),
        authService.generateRefreshToken(
          user,
          typeof deviceInfo === 'string' ? deviceInfo : undefined,
        ),
      ]);

      await authService.logActivity(user.id, 'user.registered');

      const teams = await userService.getUserTeams(user.id);

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.code(201).send({
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePass: user.mustChangePass,
          teams,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite';
      return reply.code(400).send({ error: message, statusCode: 400 });
    }
  });

  // POST /api/auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email: string };

    if (!email) {
      return reply.code(400).send({ error: 'Email is required', statusCode: 400 });
    }

    // Always return success to avoid email enumeration
    const user = await userService.getUserByEmail(email);
    if (user && user.isActive) {
      try {
        await passwordResetService.createResetRequest(user.id, user.id);
      } catch (err) {
        fastify.log.error(err, 'Failed to create password reset request');
      }
    }

    return reply.send({
      message: 'If an account with that email exists, reset instructions have been sent',
    });
  });

  // POST /api/auth/reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const { token, newPassword } = request.body as {
      token: string;
      newPassword: string;
    };

    if (!token || !newPassword) {
      return reply
        .code(400)
        .send({ error: 'token and newPassword are required', statusCode: 400 });
    }

    try {
      const reset = await passwordResetService.validateResetToken(token);
      if (!reset) {
        return reply
          .code(400)
          .send({ error: 'Invalid or expired reset token', statusCode: 400 });
      }

      await passwordResetService.resetPassword(token, newPassword);
      await authService.logActivity(reset.userId, 'user.password_reset');

      return reply.send({ message: 'Password reset successfully' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      return reply.code(400).send({ error: message, statusCode: 400 });
    }
  });

  // POST /api/auth/change-password — requires JWT authentication
  fastify.post(
    '/change-password',
    { preHandler: jwtAuth },
    async (request, reply) => {
      const user = request.user!;
      const { currentPassword, newPassword } = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      if (!currentPassword || !newPassword) {
        return reply
          .code(400)
          .send({ error: 'currentPassword and newPassword are required', statusCode: 400 });
      }

      try {
        await userService.changePassword(user.id, currentPassword, newPassword);
        await authService.logActivity(user.id, 'user.password_changed');
        return reply.send({ message: 'Password changed successfully' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to change password';
        return reply.code(400).send({ error: message, statusCode: 400 });
      }
    },
  );

  // ── Current user (/me) routes ─────────────────────────────────────────────

  // GET /api/auth/me
  fastify.get('/me', { preHandler: jwtAuth }, async (request, reply) => {
    const user = request.user!;
    try {
      const full = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePass: true,
          lastLoginAt: true,
          createdAt: true,
          teamMembers: { include: { team: { select: { id: true, name: true } } } },
        },
      });
      if (!full) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

      return reply.send({
        ...full,
        teams: full.teamMembers.map((m) => m.team),
        teamMembers: undefined,
        permissions: PERMISSIONS[full.role],
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // PATCH /api/auth/me — update own name only
  fastify.patch('/me', { preHandler: jwtAuth }, async (request, reply) => {
    const user = request.user!;
    const { name } = request.body as { name?: string };

    if (!name?.trim()) {
      return reply.code(400).send({ error: 'name is required', statusCode: 400 });
    }

    try {
      await prisma.user.update({ where: { id: user.id }, data: { name: name.trim() } });
      return reply.send({ message: 'Profile updated' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // GET /api/auth/me/sessions
  fastify.get('/me/sessions', { preHandler: jwtAuth }, async (request, reply) => {
    const user = request.user!;
    // Identify the current session via the refresh token cookie
    const currentToken = request.cookies['refresh_token'];
    try {
      const tokens = await prisma.refreshToken.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send(
        tokens.map((t) => ({
          id: t.id,
          deviceInfo: t.deviceInfo,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt,
          current: t.token === currentToken,
        })),
      );
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // DELETE /api/auth/me/sessions/:tokenId — revoke specific session
  fastify.delete('/me/sessions/:tokenId', { preHandler: jwtAuth }, async (request, reply) => {
    const user = request.user!;
    const { tokenId } = request.params as { tokenId: string };
    const currentToken = request.cookies['refresh_token'];

    try {
      const token = await prisma.refreshToken.findUnique({ where: { id: tokenId } });
      if (!token || token.userId !== user.id) {
        return reply.code(404).send({ error: 'Session not found', statusCode: 404 });
      }
      if (token.token === currentToken) {
        return reply
          .code(400)
          .send({ error: 'Use /logout to end your current session', statusCode: 400 });
      }
      await prisma.refreshToken.delete({ where: { id: tokenId } });
      return reply.send({ message: 'Session revoked' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });
}
