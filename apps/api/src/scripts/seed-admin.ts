import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma, UserRole } from '@qc-monitor/db';
import { hashPassword } from '../services/auth.service.js';

function generatePassword(length = 16): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = lower + upper + digits + special;

  // Ensure at least one of each required character type
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

async function seedAdmin() {
  const email =
    process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@qc-monitor.com';
  const name = process.env.DEFAULT_ADMIN_NAME ?? 'System Admin';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`\nAdmin user already exists: ${email} — skipping seed.\n`);
    await prisma.$disconnect();
    return;
  }

  const password = generatePassword(16);
  const hashedPassword = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: UserRole.ADMIN,
      mustChangePass: true,
    },
  });

  const w = 56;
  const pad = (s: string) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log('\n' + '╔' + '═'.repeat(w) + '╗');
  console.log('║' + pad('  🔐 Default Super Admin Created') + '║');
  console.log('╠' + '═'.repeat(w) + '╣');
  console.log('║' + pad(`  Email:    ${email}`) + '║');
  console.log('║' + pad(`  Password: ${password}`) + '║');
  console.log('║' + pad('') + '║');
  console.log(
    '║' + pad('  ⚠️  You MUST change this password on first login!') + '║',
  );
  console.log('╚' + '═'.repeat(w) + '╝\n');

  await prisma.$disconnect();
}

seedAdmin().catch((err) => {
  console.error('Seed failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
