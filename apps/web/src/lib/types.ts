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
}

export interface GroupedTestCases {
  groups: TestCaseGroup[];
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

export interface RunDetail extends TestRun {
  results: (TestResult & { testCase: TestCase; artifacts: Artifact[] })[];
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
