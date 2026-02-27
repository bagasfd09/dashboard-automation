export type RunStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';
export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'RETRIED';
export type ArtifactType = 'SCREENSHOT' | 'VIDEO' | 'TRACE' | 'LOG';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface TestCase {
  id: string;
  title: string;
  filePath: string;
  suiteName?: string;
  tags: string[];
  teamId: string;
  createdAt: string;
  updatedAt: string;
  team?: { id: string; name: string };
}

export interface TestCaseGroupStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
}

export interface TestCaseGroup {
  name: string;
  testCases: TestCase[];
  stats: TestCaseGroupStats;
  /** Inner pagination — present when innerPageSize is specified */
  pagination: PaginationMeta;
}

export interface GroupedTestCases {
  groups: TestCaseGroup[];
  /** Outer group-level pagination */
  pagination: PaginationMeta;
}

export type RetryRequestStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'EXPIRED';

export interface RetryRequest {
  id: string;
  teamId: string;
  testCaseId: string;
  status: RetryRequestStatus;
  requestedAt: string;
  pickedUpAt?: string;
  completedAt?: string;
  resultId?: string;
  testCase: { title: string; filePath: string };
  team: { name: string };
}

export interface Artifact {
  id: string;
  testResultId: string;
  type: ArtifactType;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  createdAt: string;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  retryCount: number;
  startedAt: string;
  finishedAt?: string;
  artifacts?: Artifact[];
  testCase?: TestCase;
}

export interface TestRun {
  id: string;
  teamId: string;
  status: RunStatus;
  passed: number;
  failed: number;
  skipped: number;
  totalTests: number;
  duration?: number;
  startedAt: string;
  finishedAt?: string;
  team?: { id: string; name: string };
}

export interface TestCaseDetail extends TestCase {
  results: (TestResult & { artifacts: Artifact[] })[];
}

/** Legacy — still used by reporter/team routes */
export interface RunDetail extends TestRun {
  results: (TestResult & { testCase: TestCase; artifacts: Artifact[] })[];
}

/** Paginated run detail returned by GET /api/admin/runs/:id */
export interface RunDetailPaginated {
  run: TestRun & { team?: { id: string; name: string } };
  results: {
    data: (TestResult & { testCase: TestCase; artifacts: Artifact[] })[];
    pagination: PaginationMeta;
  };
}

export interface RunResultGroup {
  suiteName: string;
  results: (TestResult & { testCase: TestCase; artifacts: Artifact[] })[];
  stats: { total: number; passed: number; failed: number; skipped: number };
  pagination: PaginationMeta;
}

export interface RunResultsGrouped {
  run: TestRun & { team?: { id: string; name: string } };
  groups: RunResultGroup[];
  pagination: PaginationMeta;
}

// ── Auth / User types ─────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'TEAM_LEAD' | 'MEMBER' | 'MONITORING';

export interface RolePermissions {
  dataScope: 'ALL_TEAMS' | 'OWN_TEAMS' | 'ASSIGNED_TEAMS';
  canCreateTeams: boolean;
  canDeleteTeams: boolean;
  canManageApiKeys: boolean;
  canRevokeApiKeys: boolean;
  canTriggerRetry: boolean;
  canViewActivityLog: boolean;
  canForceLogout: boolean;
  canInviteRoles: UserRole[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePass: boolean;
  teams: { id: string; name: string }[];
  permissions?: RolePermissions;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Session {
  id: string;
  deviceInfo: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePass?: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  teams: { id: string; name: string }[];
}

export interface ActivityLogEntry {
  id: string;
  userId: string;
  teamId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string };
  team?: { id: string; name: string } | null;
}

export interface InviteRecord {
  id: string;
  email: string;
  role: UserRole;
  teamIds: string[];
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  invitedBy?: { id: string; name: string };
}

// ── Admin types ───────────────────────────────────────────────────────────────

export interface TeamSummary {
  id: string;
  name: string;
  createdAt: string;
  totalTestCases: number;
  totalRuns: number;
  lastRunAt: string | null;
  lastRunStatus: RunStatus | null;
  passRate: number;
}

export interface RecentActivityItem {
  id: string;
  status: TestStatus;
  testCaseTitle: string;
  teamName: string;
  teamId: string;
  testRunId: string;
  startedAt: string;
}

export interface OverviewStats {
  totalTeams: number;
  totalTestCases: number;
  totalRuns: number;
  todayRuns: number;
  overallPassRate: number;
  runsByStatus: {
    running: number;
    passed: number;
    failed: number;
    cancelled: number;
  };
  recentActivity: RecentActivityItem[];
}

export interface TopFailingTest {
  id: string;
  title: string;
  failureCount: number;
}

// ── Library types ─────────────────────────────────────────────────────────────

export type TestPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TestDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'COMPLEX';
export type LibraryTestCaseStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
export type SuggestionType = 'IMPROVEMENT' | 'BUG_REPORT' | 'UPDATE' | 'OBSOLETE';
export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface LibraryCollection {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  teamId: string | null;
  team?: { id: string; name: string } | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  _count?: { testCases: number };
}

export interface LibraryTestCase {
  id: string;
  title: string;
  description: string | null;
  priority: TestPriority;
  difficulty: TestDifficulty;
  status: LibraryTestCaseStatus;
  collectionId: string | null;
  collection?: { id: string; name: string } | null;
  tags: string[];
  steps: string | null;
  preconditions: string | null;
  expectedOutcome: string | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  updatedById: string | null;
  updatedBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { linkedTestCases: number; bookmarks: number; discussions: number };
}

export interface LibraryTestCaseDetail extends LibraryTestCase {
  versions?: LibraryTestCaseVersion[];
  dependencies?: { dependsOn: { id: string; title: string; status: LibraryTestCaseStatus } }[];
  dependents?: { libraryTestCase: { id: string; title: string; status: LibraryTestCaseStatus } }[];
  linkedTestCases?: {
    id: string;
    testCaseId: string;
    autoMatched: boolean;
    createdAt: string;
    testCase: { id: string; title: string; filePath: string; team?: { id: string; name: string } };
  }[];
  _count?: { linkedTestCases: number; bookmarks: number; discussions: number; suggestions: number };
}

export interface LibraryTestCaseVersion {
  id: string;
  libraryTestCaseId: string;
  version: number;
  title: string;
  description: string | null;
  steps: string | null;
  preconditions: string | null;
  expectedOutcome: string | null;
  changeNotes: string | null;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface LibrarySuggestion {
  id: string;
  libraryTestCaseId: string;
  libraryTestCase?: {
    id: string;
    title: string;
    collection?: { id: string; name: string } | null;
  };
  type: SuggestionType;
  content: string;
  status: SuggestionStatus;
  createdById: string;
  createdBy?: { id: string; name: string };
  reviewedById: string | null;
  reviewedBy?: { id: string; name: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryDiscussion {
  id: string;
  libraryTestCaseId: string;
  content: string;
  createdById: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface LibraryBookmark {
  id: string;
  libraryTestCaseId: string;
  userId: string;
  createdAt: string;
  libraryTestCase?: {
    id: string;
    title: string;
    priority: TestPriority;
    status: LibraryTestCaseStatus;
    collection?: { id: string; name: string } | null;
  };
}

export interface LibraryCoverageStats {
  total: number;
  linked: number;
  unlinked: number;
  coverage: number;
  byStatus: { status: LibraryTestCaseStatus; count: number }[];
  byPriority: { priority: TestPriority; count: number }[];
}

export interface TeamDetailStats {
  team: { id: string; name: string; createdAt: string };
  testCases: { total: number; withFailures: number; withoutRuns: number };
  runs: { total: number; thisWeek: number; passRate: number; avgDuration: number };
  topFailingTests: TopFailingTest[];
  recentRuns: {
    id: string;
    status: RunStatus;
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    startedAt: string;
    duration: number | null;
  }[];
}
