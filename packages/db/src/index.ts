import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ?? new PrismaClient({ log: ['error'] });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export { PrismaClient } from '@prisma/client';
export type {
  Team,
  TestCase,
  TestRun,
  TestResult,
  Artifact,
  RetryRequest,
  Prisma,
} from '@prisma/client';
export { RunStatus, TestStatus, ArtifactType, RetryRequestStatus } from '@prisma/client';
