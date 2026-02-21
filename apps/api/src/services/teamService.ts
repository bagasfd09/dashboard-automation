import { prisma } from '@qc-monitor/db';
import type { Team } from '@qc-monitor/db';

export async function createTeam(name: string): Promise<Team> {
  return prisma.team.create({ data: { name } });
}
