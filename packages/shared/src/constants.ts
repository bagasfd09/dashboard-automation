export const RUN_STATUS = {
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const TEST_STATUS = {
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  RETRIED: 'RETRIED',
} as const;

export const ARTIFACT_TYPE = {
  SCREENSHOT: 'SCREENSHOT',
  VIDEO: 'VIDEO',
  TRACE: 'TRACE',
  LOG: 'LOG',
} as const;

export const API_ROUTES = {
  HEALTH: '/health',
  TEAMS: '/teams',
  TEST_RUNS: '/test-runs',
  TEST_RESULTS: '/test-results',
  ARTIFACTS: '/artifacts',
} as const;

export const DEFAULT_PORT = 3001;
