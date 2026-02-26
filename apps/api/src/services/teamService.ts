import { prisma } from '@qc-monitor/db';
import type { Team } from '@qc-monitor/db';
import crypto from 'crypto';

export async function createTeam(name: string): Promise<Team> {
  return prisma.team.create({ data: { name } });
}

export async function updateTeam(id: string, data: { name?: string }): Promise<Team | null> {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return null;
  return prisma.team.update({ where: { id }, data });
}

export async function deleteTeam(id: string): Promise<boolean> {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) return false;
  await prisma.team.delete({ where: { id } });
  return true;
}

export async function rotateApiKey(teamId: string): Promise<Team | null> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;
  const newKey = crypto.randomBytes(20).toString('hex');
  return prisma.team.update({ where: { id: teamId }, data: { apiKey: newKey } });
}
