import { prisma } from '@qc-monitor/db';
import type { User, Invite, InviteStatus, UserRole, Prisma } from '@qc-monitor/db';
import { createUser } from './user.service.js';

export async function createInvite(data: {
  email: string;
  role: UserRole;
  teamIds: string[];
  invitedById: string;
}): Promise<Invite> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return prisma.invite.create({
    data: {
      email: data.email,
      role: data.role,
      teamIds: data.teamIds,
      invitedById: data.invitedById,
      expiresAt,
    },
  });
}

export async function getInviteByToken(token: string): Promise<Invite | null> {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) return null;
  if (invite.status !== 'PENDING') return null;
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    });
    return null;
  }
  return invite;
}

export async function acceptInvite(
  token: string,
  password: string,
  name: string,
): Promise<User> {
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invalid or expired invite token');

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existingUser) throw new Error('User with this email already exists');

  const user = await createUser({
    email: invite.email,
    name,
    password,
    role: invite.role,
    mustChangePass: false,
  });

  if (invite.teamIds.length > 0) {
    await prisma.teamMember.createMany({
      data: invite.teamIds.map((teamId) => ({ userId: user.id, teamId })),
      skipDuplicates: true,
    });
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: 'ACCEPTED' },
  });

  return user;
}

export async function cancelInvite(id: string): Promise<Invite> {
  return prisma.invite.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

type InviteWithSender = Prisma.InviteGetPayload<{
  include: { invitedBy: { select: { id: true; name: true; email: true } } };
}>;

type ListInvitesResult = {
  items: InviteWithSender[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listInvites(filters: {
  status?: InviteStatus;
  email?: string;
  page?: number;
  pageSize?: number;
}): Promise<ListInvitesResult> {
  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 20);
  const skip = (page - 1) * pageSize;

  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.email && { email: { contains: filters.email } }),
  };

  const [items, total] = await Promise.all([
    prisma.invite.findMany({
      where,
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.invite.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function cleanupExpiredInvites(): Promise<number> {
  const result = await prisma.invite.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
  return result.count;
}
