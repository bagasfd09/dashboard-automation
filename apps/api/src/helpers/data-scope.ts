import { prisma } from '@qc-monitor/db';
import type { UserRole } from '@qc-monitor/db';
import { PERMISSIONS } from '../middleware/permission.middleware.js';

export type UserInfo = { id: string; email: string; role: UserRole };

/**
 * Returns all team IDs accessible to the user.
 * ALL_TEAMS roles → every team in the DB.
 * OWN_TEAMS / ASSIGNED_TEAMS → only the user's TeamMember records.
 */
export async function getAccessibleTeamIds(user: UserInfo): Promise<string[]> {
  const { dataScope } = PERMISSIONS[user.role];
  if (dataScope === 'ALL_TEAMS') {
    const teams = await prisma.team.findMany({ select: { id: true } });
    return teams.map((t) => t.id);
  }
  const members = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { teamId: true },
  });
  return members.map((m) => m.teamId);
}

/**
 * Returns a Prisma `where` fragment that restricts queries to the user's
 * accessible teams.  For ALL_TEAMS returns `{}` (no restriction).
 */
export async function scopedTeamFilter(
  user: UserInfo,
): Promise<{ teamId?: { in: string[] } }> {
  const { dataScope } = PERMISSIONS[user.role];
  if (dataScope === 'ALL_TEAMS') return {};
  const members = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { teamId: true },
  });
  return { teamId: { in: members.map((m) => m.teamId) } };
}

/** Returns true if the user can access the given team. */
export async function canUserAccessTeam(user: UserInfo, teamId: string): Promise<boolean> {
  const { dataScope } = PERMISSIONS[user.role];
  if (dataScope === 'ALL_TEAMS') return true;
  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });
  return member !== null;
}

/**
 * Resolves the effective team scope for list routes.
 * - If `requestedTeamId` is given: validates access; returns `{ teamId }`.
 * - Otherwise: returns `{ scopeTeamIds }` for OWN/ASSIGNED roles, or `{}` for ALL_TEAMS.
 * Returns `null` when access to `requestedTeamId` is denied (caller should 403).
 */
export async function resolveTeamScope(
  user: UserInfo,
  requestedTeamId?: string,
): Promise<{ teamId?: string; scopeTeamIds?: string[] } | null> {
  const { dataScope } = PERMISSIONS[user.role];
  if (dataScope === 'ALL_TEAMS') return { teamId: requestedTeamId };

  const members = await prisma.teamMember.findMany({
    where: { userId: user.id },
    select: { teamId: true },
  });
  const userTeamIds = members.map((m) => m.teamId);

  if (requestedTeamId) {
    if (!userTeamIds.includes(requestedTeamId)) return null; // forbidden
    return { teamId: requestedTeamId };
  }
  return { scopeTeamIds: userTeamIds };
}
