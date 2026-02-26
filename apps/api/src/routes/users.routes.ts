import type { FastifyInstance } from 'fastify';
import { prisma } from '@qc-monitor/db';
import type { UserRole } from '@qc-monitor/db';
import { requireAuth, requirePermission, PERMISSIONS } from '../middleware/permission.middleware.js';
import { canUserAccessTeam, resolveTeamScope } from '../helpers/data-scope.js';
import * as userService from '../services/user.service.js';
import * as inviteService from '../services/invite.service.js';
import * as passwordResetService from '../services/password-reset.service.js';
import { logActivity, revokeAllUserTokens } from '../services/auth.service.js';

// Roles that MANAGER can manage
const BELOW_MANAGER: UserRole[] = ['SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'];
// Roles that TEAM_LEAD can manage
const BELOW_TEAM_LEAD: UserRole[] = ['MEMBER', 'MONITORING'];

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = requireAuth();

  // ── GET /api/admin/users ──────────────────────────────────────────────────

  fastify.get('/', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const q = request.query as {
      role?: UserRole;
      teamId?: string;
      search?: string;
      isActive?: string;
      page?: number;
      pageSize?: number;
    };

    // Permission check
    if (!['ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    const page = Number(q.page ?? 1);
    const pageSize = Number(q.pageSize ?? 20);

    if (Number.isNaN(page) || Number.isNaN(pageSize)) {
      return reply.code(400).send({
        error: 'Invalid pagination parameters',
        statusCode: 400,
      });
    }

const skip = (page - 1) * pageSize;
    const where: Record<string, unknown> = {};
    if (q.role) where['role'] = q.role;
    if (q.isActive !== undefined) where['isActive'] = q.isActive === 'true';
    if (q.search) {
      where['OR'] = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    // TEAM_LEAD: only users in own teams
    if (user.role === 'TEAM_LEAD') {
      const myTeams = await prisma.teamMember.findMany({
        where: { userId: user.id },
        select: { teamId: true },
      });
      const myTeamIds = myTeams.map((m) => m.teamId);
      const teamFilter = q.teamId
        ? myTeamIds.includes(q.teamId)
          ? q.teamId
          : null
        : undefined;
      if (teamFilter === null) {
        return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
      }
      where['teamMembers'] = teamFilter
        ? { some: { teamId: teamFilter } }
        : { some: { teamId: { in: myTeamIds } } };
    } else if (q.teamId) {
      where['teamMembers'] = { some: { teamId: q.teamId } };
    }

    try {
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            teamMembers: { include: { team: { select: { id: true, name: true } } } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      const data = items.map((u) => ({
        ...u,
        teams: u.teamMembers.map((m) => m.team),
        teamMembers: undefined,
      }));

      return reply.send({
        data,
        pagination: {
          page,
          pageSize,
          totalItems: total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── GET /api/admin/users/:id ──────────────────────────────────────────────

  fastify.get('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    if (!['ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      const target = await prisma.user.findUnique({
        where: { id },
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
          activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      });
      if (!target) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

      // TEAM_LEAD: only users in own team
      if (user.role === 'TEAM_LEAD') {
        const targetTeamIds = target.teamMembers.map((m) => m.team.id);
        const hasShared = await prisma.teamMember.findFirst({
          where: { userId: user.id, teamId: { in: targetTeamIds } },
        });
        if (!hasShared) {
          return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
        }
      }

      return reply.send({
        ...target,
        teams: target.teamMembers.map((m) => m.team),
        teamMembers: undefined,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── POST /api/admin/users/invite ──────────────────────────────────────────

  fastify.post('/invite', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { email, role, teamIds = [] } = request.body as {
      email: string;
      role: UserRole;
      teamIds?: string[];
    };

    const perms = PERMISSIONS[user.role];

    // Check if this role can invite anyone
    if (!perms.canInviteRoles.length) {
      return reply.code(403).send({ error: 'Insufficient permissions to invite users', statusCode: 403 });
    }

    // Check if inviter can invite the requested role
    if (!(perms.canInviteRoles as string[]).includes(role)) {
      return reply
        .code(403)
        .send({ error: `You cannot invite users with role ${role}`, statusCode: 403 });
    }

    // Validate teamIds: inviter must have access to each team
    for (const teamId of teamIds) {
      if (!(await canUserAccessTeam(user, teamId))) {
        return reply
          .code(403)
          .send({ error: `Access denied to team ${teamId}`, statusCode: 403 });
      }
    }

    // TEAM_LEAD: can only invite to own teams
    if (user.role === 'TEAM_LEAD' && teamIds.length === 0) {
      return reply.code(400).send({ error: 'TEAM_LEAD must specify at least one team', statusCode: 400 });
    }

    if (!email || !role) {
      return reply.code(400).send({ error: 'email and role are required', statusCode: 400 });
    }

    try {
      const invite = await inviteService.createInvite({
        email,
        role,
        teamIds,
        invitedById: user.id,
      });
      await logActivity(user.id, 'user.invited', undefined, { email, role });

      const inviteLink = `${process.env.APP_URL ?? 'http://localhost:3000'}/auth/accept-invite?token=${invite.token}`;

      return reply.code(201).send({ invite, inviteLink });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── PATCH /api/admin/users/:id ────────────────────────────────────────────

  fastify.patch('/:id', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { name, role, isActive, teamIds } = request.body as {
      name?: string;
      role?: UserRole;
      isActive?: boolean;
      teamIds?: string[];
    };

    if (!['ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    // Cannot change own role or deactivate self
    if (id === user.id && (role !== undefined || isActive === false)) {
      return reply.code(400).send({ error: 'Cannot change own role or deactivate yourself', statusCode: 400 });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

      // Role-based restrictions
      if (user.role === 'MANAGER' && !BELOW_MANAGER.includes(target.role)) {
        return reply.code(403).send({ error: 'Cannot edit users with equal or higher role', statusCode: 403 });
      }
      if (user.role === 'TEAM_LEAD') {
        if (!BELOW_TEAM_LEAD.includes(target.role)) {
          return reply.code(403).send({ error: 'TEAM_LEAD can only edit MEMBER or MONITORING users', statusCode: 403 });
        }
        // Must share a team
        const shared = await prisma.teamMember.findFirst({
          where: {
            teamId: { in: (await prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } })).map((m) => m.teamId) },
            userId: id,
          },
        });
        if (!shared) {
          return reply.code(403).send({ error: 'Access denied to this user', statusCode: 403 });
        }
        // TEAM_LEAD cannot change role
        if (role !== undefined) {
          return reply.code(403).send({ error: 'TEAM_LEAD cannot change user roles', statusCode: 403 });
        }
      }

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates['name'] = name;
      if (role !== undefined && user.role === 'ADMIN') updates['role'] = role;
      if (isActive !== undefined) updates['isActive'] = isActive;

      await prisma.user.update({ where: { id }, data: updates });

      // Update team assignments (ADMIN only)
      if (teamIds !== undefined && user.role === 'ADMIN') {
        await prisma.teamMember.deleteMany({ where: { userId: id } });
        if (teamIds.length > 0) {
          await prisma.teamMember.createMany({
            data: teamIds.map((teamId) => ({ userId: id, teamId })),
            skipDuplicates: true,
          });
        }
      }

      if (isActive === false) await revokeAllUserTokens(id);

      await logActivity(user.id, 'user.updated', undefined, { targetUserId: id, updates });
      return reply.send({ message: 'User updated' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── DELETE /api/admin/users/:id — ADMIN only ──────────────────────────────

  fastify.delete(
    '/:id',
    { preHandler: [auth, requirePermission('canDeleteTeams')] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      if (id === user.id) {
        return reply.code(400).send({ error: 'Cannot delete yourself', statusCode: 400 });
      }

      try {
        const target = await prisma.user.findUnique({ where: { id } });
        if (!target) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

        await userService.deactivateUser(id);
        await prisma.user.delete({ where: { id } });
        await logActivity(user.id, 'user.deleted', undefined, { targetUserId: id });
        return reply.send({ message: 'User deleted' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── POST /api/admin/users/:id/reset-password ──────────────────────────────

  fastify.post('/:id/reset-password', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

      if (user.role === 'ADMIN') {
        // ADMIN can reset any user
      } else if (user.role === 'TEAM_LEAD') {
        if (!BELOW_TEAM_LEAD.includes(target.role)) {
          return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
        }
        const shared = await prisma.teamMember.findFirst({
          where: {
            teamId: { in: (await prisma.teamMember.findMany({ where: { userId: user.id }, select: { teamId: true } })).map((m) => m.teamId) },
            userId: id,
          },
        });
        if (!shared) return reply.code(403).send({ error: 'Access denied', statusCode: 403 });
      } else {
        return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
      }

      const resetLink = await passwordResetService.createResetRequest(id, user.id);
      await logActivity(user.id, 'user.password_reset_requested', undefined, { targetUserId: id });
      return reply.send({ resetLink });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });

  // ── POST /api/admin/users/:id/force-logout — ADMIN only ──────────────────

  fastify.post(
    '/:id/force-logout',
    { preHandler: [auth, requirePermission('canForceLogout')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await revokeAllUserTokens(id);
        await logActivity(request.user!.id, 'user.force_logout', undefined, { targetUserId: id });
        return reply.send({ message: 'User sessions revoked' });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
      }
    },
  );

  // ── POST /api/admin/users/:id/toggle-active ───────────────────────────────

  fastify.post('/:id/toggle-active', { preHandler: auth }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { isActive } = request.body as { isActive: boolean };

    if (!['ADMIN', 'MANAGER'].includes(user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }

    try {
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) return reply.code(404).send({ error: 'User not found', statusCode: 404 });

      // MANAGER: only below-manager roles
      if (user.role === 'MANAGER' && !BELOW_MANAGER.includes(target.role)) {
        return reply.code(403).send({ error: 'Cannot manage users with equal or higher role', statusCode: 403 });
      }

      await prisma.user.update({ where: { id }, data: { isActive } });
      if (!isActive) await revokeAllUserTokens(id);

      const action = isActive ? 'user.activated' : 'user.deactivated';
      await logActivity(user.id, action, undefined, { targetUserId: id });
      return reply.send({ message: `User ${isActive ? 'activated' : 'deactivated'}` });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error', statusCode: 500 });
    }
  });
}
