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
  User,
  TeamMember,
  RefreshToken,
  Invite,
  PasswordReset,
  ActivityLog,
  LibraryCollection,
  LibraryTestCase,
  LibraryTestCaseVersion,
  LibraryDependency,
  LibrarySuggestion,
  LibraryDiscussion,
  LibraryBookmark,
  LibraryTestCaseLink,
  Release,
  ReleaseTestRun,
  ReleaseChecklistItem,
  Application,
  TaskGroup,
  TaskGroupItem,
  Prisma,
} from '@prisma/client';
export {
  RunStatus,
  RunSource,
  TestStatus,
  ArtifactType,
  RetryRequestStatus,
  UserRole,
  InviteStatus,
  TestPriority,
  TestDifficulty,
  LibraryTestCaseStatus,
  SuggestionType,
  SuggestionStatus,
  ReleaseStatus,
  ChecklistItemType,
  ChecklistItemStatus,
  TaskGroupStatus,
  TaskItemPersonalStatus,
} from '@prisma/client';
