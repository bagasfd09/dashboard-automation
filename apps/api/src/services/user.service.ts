import { prisma } from '@qc-monitor/db';
import type { User, UserRole, Prisma } from '@qc-monitor/db';
import {
  hashPassword,
  verifyPassword,
  revokeAllUserTokens,
} from './auth.service.js';

export async function createUser(data: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  mustChangePass?: boolean;
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password);
  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role: data.role,
      mustChangePass: data.mustChangePass ?? true,
    },
  });
}

type UserWithTeams = Prisma.UserGetPayload<{
  include: { teamMembers: { include: { team: true } } };
}>;

export async function getUserById(id: string): Promise<UserWithTeams | null> {
  return prisma.user.findUnique({
    where: { id },
    include: {
      teamMembers: {
        include: { team: true },
      },
    },
  });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; role: UserRole; isActive: boolean }>,
): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const valid = await verifyPassword(currentPassword, user.password);
  if (!valid) throw new Error('Current password is incorrect');

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, mustChangePass: false },
  });
}

export async function forceChangePassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword, mustChangePass: true },
  });
}

export async function deactivateUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
  await revokeAllUserTokens(userId);
}

export async function getUserTeams(userId: string) {
  const members = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
  });
  return members.map((m) => m.team);
}
