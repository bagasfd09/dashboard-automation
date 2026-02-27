import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@qc-monitor/db';
import type { UserRole } from '@qc-monitor/db';
import { verifyAccessToken } from '../services/auth.service.js';

// ── Permission map ────────────────────────────────────────────────────────────

interface RolePermissions {
  dataScope: 'ALL_TEAMS' | 'OWN_TEAMS' | 'ASSIGNED_TEAMS';
  canInviteRoles: UserRole[];
  canManageAllTeams: boolean;
  canCreateTeams: boolean;
  canDeleteTeams: boolean;
  canTriggerRetry: boolean;
  canManageApiKeys: boolean;
  canRevokeApiKeys: boolean;
  canViewActivityLog: boolean;
  canManageSystemSettings: boolean;
  canResetAnyPassword: boolean;
  canForceLogout: boolean;
  canManageLibrary: boolean;
  canManageReleases: boolean;
}

export type BooleanPermissionKey = {
  [K in keyof RolePermissions]: RolePermissions[K] extends boolean ? K : never;
}[keyof RolePermissions];

export const PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN: {
    dataScope: 'ALL_TEAMS',
    canInviteRoles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'],
    canManageAllTeams: true,
    canCreateTeams: true,
    canDeleteTeams: true,
    canTriggerRetry: true,
    canManageApiKeys: true,
    canRevokeApiKeys: true,
    canViewActivityLog: true,
    canManageSystemSettings: true,
    canResetAnyPassword: true,
    canForceLogout: true,
    canManageLibrary: true,
    canManageReleases: true,
  },
  MANAGER: {
    dataScope: 'ALL_TEAMS',
    canInviteRoles: ['SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'],
    canManageAllTeams: false,
    canCreateTeams: false,
    canDeleteTeams: false,
    canTriggerRetry: true,
    canManageApiKeys: false,
    canRevokeApiKeys: false,
    canViewActivityLog: true,
    canManageSystemSettings: false,
    canResetAnyPassword: false,
    canForceLogout: false,
    canManageLibrary: true,
    canManageReleases: true,
  },
  SUPERVISOR: {
    dataScope: 'ALL_TEAMS',
    canInviteRoles: [],
    canManageAllTeams: false,
    canCreateTeams: false,
    canDeleteTeams: false,
    canTriggerRetry: false,
    canManageApiKeys: false,
    canRevokeApiKeys: false,
    canViewActivityLog: true,
    canManageSystemSettings: false,
    canResetAnyPassword: false,
    canForceLogout: false,
    canManageLibrary: false,
    canManageReleases: false,
  },
  TEAM_LEAD: {
    dataScope: 'OWN_TEAMS',
    canInviteRoles: ['MEMBER', 'MONITORING'],
    canManageAllTeams: false,
    canCreateTeams: false,
    canDeleteTeams: false,
    canTriggerRetry: true,
    canManageApiKeys: true,
    canRevokeApiKeys: false,
    canViewActivityLog: true,
    canManageSystemSettings: false,
    canResetAnyPassword: false,
    canForceLogout: false,
    canManageLibrary: true,
    canManageReleases: true,
  },
  MEMBER: {
    dataScope: 'OWN_TEAMS',
    canInviteRoles: [],
    canManageAllTeams: false,
    canCreateTeams: false,
    canDeleteTeams: false,
    canTriggerRetry: true,
    canManageApiKeys: false,
    canRevokeApiKeys: false,
    canViewActivityLog: false,
    canManageSystemSettings: false,
    canResetAnyPassword: false,
    canForceLogout: false,
    canManageLibrary: false,
    canManageReleases: false,
  },
  MONITORING: {
    dataScope: 'ASSIGNED_TEAMS',
    canInviteRoles: [],
    canManageAllTeams: false,
    canCreateTeams: false,
    canDeleteTeams: false,
    canTriggerRetry: false,
    canManageApiKeys: false,
    canRevokeApiKeys: false,
    canViewActivityLog: false,
    canManageSystemSettings: false,
    canResetAnyPassword: false,
    canForceLogout: false,
    canManageLibrary: false,
    canManageReleases: false,
  },
};

// ── Middleware factories ───────────────────────────────────────────────────────

/**
 * Verifies JWT Bearer token OR x-admin-key (backwards compatible).
 * x-admin-key auth creates a synthetic ADMIN user context.
 */
export function requireAuth() {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessToken(authHeader.slice(7));
        request.user = { id: payload.userId, email: payload.email, role: payload.role };
        return;
      } catch {
        return reply.code(401).send({ error: 'Invalid or expired token', statusCode: 401 });
      }
    }

    // Fallback: x-admin-key (backwards compatible — grants full ADMIN access)
    const secret = process.env.ADMIN_SECRET_KEY;
    const key = request.headers['x-admin-key'];
    if (secret && key && typeof key === 'string' && key === secret) {
      request.user = { id: '__apikey__', email: 'system', role: 'ADMIN' as UserRole };
      request.isAdmin = true;
      return;
    }

    return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
  };
}

/** Checks that the authenticated user has one of the specified roles. */
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }
  };
}

/** Checks that the authenticated user's role has a specific boolean permission. */
export function requirePermission(permission: BooleanPermissionKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    if (!PERMISSIONS[request.user.role][permission]) {
      return reply.code(403).send({ error: 'Insufficient permissions', statusCode: 403 });
    }
  };
}

/**
 * Checks that the authenticated user can access the team identified by
 * the given route param name.
 * ADMIN / MANAGER / SUPERVISOR always pass (ALL_TEAMS scope).
 * TEAM_LEAD / MEMBER / MONITORING must be a TeamMember of that team.
 */
export function requireTeamAccess(teamIdParam: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
    }
    const { dataScope } = PERMISSIONS[request.user.role];
    if (dataScope === 'ALL_TEAMS') return;

    const teamId = (request.params as Record<string, string>)[teamIdParam];
    if (!teamId) {
      return reply.code(400).send({ error: 'Team ID required', statusCode: 400 });
    }

    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: request.user.id, teamId } },
    });
    if (!member) {
      return reply.code(403).send({ error: 'Access denied to this team', statusCode: 403 });
    }
  };
}
