// Enums mirroring Prisma schema
export enum RunStatus {
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TestStatus {
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  RETRIED = 'RETRIED',
}

export enum ArtifactType {
  SCREENSHOT = 'SCREENSHOT',
  VIDEO = 'VIDEO',
  TRACE = 'TRACE',
  LOG = 'LOG',
}

// Entity types mirroring Prisma models
export interface Team {
  id: string;
  name: string;
  apiKey: string;
  createdAt: Date;
}

export interface TestCase {
  id: string;
  title: string;
  filePath: string;
  tags: string[];
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestRun {
  id: string;
  teamId: string;
  status: RunStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface TestResult {
  id: string;
  testCaseId: string;
  testRunId: string;
  status: TestStatus;
  duration: number | null;
  error: string | null;
  retryCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface Artifact {
  id: string;
  testResultId: string;
  type: ArtifactType;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  createdAt: Date;
}

// API payload types
export interface CreateTestRunPayload {
  teamId: string;
}

export interface ReportTestResultPayload {
  testRunId: string;
  title: string;
  filePath: string;
  tags?: string[];
  status: TestStatus;
  duration?: number;
  error?: string;
  retryCount?: number;
}

export interface FinishTestRunPayload {
  testRunId: string;
  status: RunStatus;
  duration?: number;
}
