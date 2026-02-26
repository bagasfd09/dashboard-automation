import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@qc-monitor/db';
import type { UserRole } from '@qc-monitor/db';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

export async function generateRefreshToken(
  user: { id: string },
  deviceInfo?: string,
): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: { token, userId: user.id, expiresAt, deviceInfo },
  });

  return token;
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret) as JwtPayload;
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } });
    }
    throw new Error('Invalid or expired refresh token');
  }

  if (!stored.user.isActive) {
    throw new Error('User account is deactivated');
  }

  return generateAccessToken(stored.user);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function logActivity(
  userId: string,
  action: string,
  teamId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  if (userId === '__apikey__') return; // x-admin-key auth — no real user to log
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        teamId,
        details: details ? JSON.stringify(details) : undefined,
      },
    });
  } catch {
    // Non-fatal — never break the request flow due to logging failures
  }
}
