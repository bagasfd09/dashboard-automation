import { prisma } from '@qc-monitor/db';
import type { Application } from '@qc-monitor/db';

export interface CreateApplicationInput {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  environments?: string[];
  teamId: string;
  createdById: string;
}

export interface UpdateApplicationInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  environments?: string[];
  isActive?: boolean;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function listApplications(
  teamIds?: string[],
): Promise<Application[]> {
  return prisma.application.findMany({
    where: teamIds ? { teamId: { in: teamIds } } : undefined,
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { testRuns: true, testCases: true, releases: true } },
    },
    orderBy: [{ teamId: 'asc' }, { name: 'asc' }],
  });
}

export async function getApplication(id: string): Promise<Application | null> {
  return prisma.application.findUnique({
    where: { id },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { testRuns: true, testCases: true, releases: true } },
    },
  });
}

export async function getApplicationBySlug(
  teamId: string,
  slug: string,
): Promise<Application | null> {
  return prisma.application.findUnique({
    where: { teamId_slug: { teamId, slug } },
  });
}

export async function createApplication(
  input: CreateApplicationInput,
): Promise<Application> {
  const slug = toSlug(input.slug || input.name);
  return prisma.application.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      environments: input.environments ?? ['development', 'staging', 'production'],
      teamId: input.teamId,
      createdById: input.createdById,
    },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { testRuns: true, testCases: true, releases: true } },
    },
  });
}

export async function updateApplication(
  id: string,
  input: UpdateApplicationInput,
): Promise<Application> {
  return prisma.application.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.environments !== undefined && { environments: input.environments }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: {
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { testRuns: true, testCases: true, releases: true } },
    },
  });
}

export async function deleteApplication(id: string): Promise<void> {
  await prisma.application.delete({ where: { id } });
}
