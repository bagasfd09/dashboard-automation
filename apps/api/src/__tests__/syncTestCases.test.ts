import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @qc-monitor/db before importing the service
vi.mock('@qc-monitor/db', () => ({
  prisma: {
    testCase: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { syncTestCases } from '../services/testCaseService.js';
import { prisma } from '@qc-monitor/db';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('syncTestCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes suiteName into upsert create and update when provided', async () => {
    vi.mocked(prisma.testCase.upsert).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await syncTestCases('team-1', [
      { title: 'should login', filePath: 'auth.spec.ts', suiteName: 'Auth > Login' },
    ]);

    expect(prisma.testCase.upsert).toHaveBeenCalledOnce();
    expect(prisma.testCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ suiteName: 'Auth > Login' }),
        update: expect.objectContaining({ suiteName: 'Auth > Login' }),
      }),
    );
  });

  it('passes undefined suiteName when not provided', async () => {
    vi.mocked(prisma.testCase.upsert).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await syncTestCases('team-1', [
      { title: 'standalone test', filePath: 'misc.spec.ts' },
    ]);

    expect(prisma.testCase.upsert).toHaveBeenCalledOnce();
    expect(prisma.testCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ suiteName: undefined }),
        update: expect.objectContaining({ suiteName: undefined }),
      }),
    );
  });

  it('passes teamId and filePath to the upsert where clause', async () => {
    vi.mocked(prisma.testCase.upsert).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await syncTestCases('team-abc', [
      { title: 'my test', filePath: 'tests/my.spec.ts', suiteName: 'Suite' },
    ]);

    expect(prisma.testCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId_filePath_title: {
            teamId: 'team-abc',
            filePath: 'tests/my.spec.ts',
            title: 'my test',
          },
        },
      }),
    );
  });

  it('calls upsert once per test case and wraps all in a transaction', async () => {
    vi.mocked(prisma.testCase.upsert).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    const testCases = [
      { title: 'test A', filePath: 'a.spec.ts', suiteName: 'Suite A' },
      { title: 'test B', filePath: 'b.spec.ts', suiteName: 'Suite B' },
      { title: 'test C', filePath: 'c.spec.ts' },
    ];

    await syncTestCases('team-1', testCases);

    expect(prisma.testCase.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('uses empty tags array when tags are not provided', async () => {
    vi.mocked(prisma.testCase.upsert).mockReturnValue({} as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([]);

    await syncTestCases('team-1', [{ title: 'test', filePath: 'test.spec.ts' }]);

    expect(prisma.testCase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tags: [] }),
        update: expect.objectContaining({ tags: [] }),
      }),
    );
  });
});
