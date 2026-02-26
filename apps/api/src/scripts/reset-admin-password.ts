import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '@qc-monitor/db';
import { hashPassword } from '../services/auth.service.js';

function generatePassword(length = 16): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = lower + upper + digits + special;

  const required = [
    lower[crypto.randomInt(lower.length)],
    upper[crypto.randomInt(upper.length)],
    digits[crypto.randomInt(digits.length)],
    special[crypto.randomInt(special.length)],
  ];

  const remaining = Array.from({ length: length - required.length }, () =>
    all[crypto.randomInt(all.length)],
  );

  return [...required, ...remaining]
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
}

async function resetAdminPassword() {
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@qc-monitor.com';

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`\n❌ No user found with email: ${email}\n`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const password = generatePassword(16);
  const hashed = await hashPassword(password);

  await prisma.user.update({
    where: { email },
    data: { password: hashed, mustChangePass: true },
  });

  const w = 56;
  const pad = (s: string) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log('\n' + '╔' + '═'.repeat(w) + '╗');
  console.log('║' + pad('  🔑 Admin Password Reset') + '║');
  console.log('╠' + '═'.repeat(w) + '╣');
  console.log('║' + pad(`  Email:    ${email}`) + '║');
  console.log('║' + pad(`  Password: ${password}`) + '║');
  console.log('║' + pad('') + '║');
  console.log('║' + pad('  ⚠️  Change this password after login!') + '║');
  console.log('╚' + '═'.repeat(w) + '╝\n');

  await prisma.$disconnect();
}

resetAdminPassword().catch((err) => {
  console.error('Reset failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
