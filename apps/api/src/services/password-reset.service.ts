import { prisma } from '@qc-monitor/db';
import { hashPassword, revokeAllUserTokens } from './auth.service.js';

export async function createResetRequest(
  userId: string,
  requestedById: string,
): Promise<string> {
  // Invalidate any previous reset tokens for this user
  await prisma.passwordReset.deleteMany({ where: { userId } });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const reset = await prisma.passwordReset.create({
    data: { userId, expiresAt },
  });

  const resetLink = `${process.env.APP_URL ?? 'http://localhost:3000'}/reset-password?token=${reset.token}`;

  // Log to console — no email service yet
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  const requester = await prisma.user.findUnique({
    where: { id: requestedById },
    select: { email: true, name: true },
  });

  console.log('\n--- PASSWORD RESET REQUESTED ---');
  console.log(`Requested by: ${requester?.name} (${requester?.email})`);
  console.log(`For user:     ${user?.name} (${user?.email})`);
  console.log(`Reset link:   ${resetLink}`);
  console.log(`Expires:      ${expiresAt.toISOString()}`);
  console.log('--------------------------------\n');

  return resetLink;
}

export async function validateResetToken(token: string) {
  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset) return null;
  if (reset.usedAt) return null;
  if (reset.expiresAt < new Date()) return null;
  return reset;
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const reset = await validateResetToken(token);
  if (!reset) throw new Error('Invalid or expired reset token');

  const hashedPassword = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { password: hashedPassword, mustChangePass: false },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await revokeAllUserTokens(reset.userId);
}
