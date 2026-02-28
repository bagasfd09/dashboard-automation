import { prisma } from '@qc-monitor/db';
import { eventService } from './eventService.js';
import { checkAndAutoComplete } from './taskGroup.service.js';

// ── Fuzzy matching ────────────────────────────────────────────────────────────

/**
 * Dice coefficient similarity — good for test case title comparison.
 * Returns 0–100.
 */
function diceSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 100;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }

  let intersectionSize = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (bigrams1.has(s2.substring(i, i + 2))) intersectionSize++;
  }

  return Math.round((2 * intersectionSize) / (s1.length - 1 + s2.length - 1) * 100);
}

/**
 * Determines branch match type between a task group branch and a run branch.
 * Returns 'exact', 'prefix', or 'none'.
 */
function getBranchMatchType(
  taskBranch: string | null | undefined,
  runBranch: string | null | undefined,
): 'exact' | 'prefix' | 'none' {
  if (!taskBranch || !runBranch) return 'none';
  if (taskBranch === runBranch) return 'exact';
  if (runBranch.startsWith(taskBranch) || taskBranch.startsWith(runBranch)) return 'prefix';
  return 'none';
}

// ── Match result ──────────────────────────────────────────────────────────────

interface MatchResult {
  taskGroupItemId: string;
  taskGroupId: string;
  taskGroupUserId: string;
  testCaseTitle: string;
  matchType: 'branch_exact' | 'branch_prefix' | 'title_only';
  confidence: number;
  resultStatus: 'PASSED' | 'FAILED';
  testRunId: string;
}

// ── Main match function ───────────────────────────────────────────────────────

/**
 * Called after every test run is ingested.
 * Matches test results to active TaskGroupItems and updates their statuses.
 */
export async function matchTestRunToTasks(testRunId: string): Promise<void> {
  const testRun = await prisma.testRun.findUnique({
    where: { id: testRunId },
    include: {
      results: {
        include: {
          testCase: { select: { title: true } },
        },
        where: { status: { in: ['PASSED', 'FAILED'] } },
      },
    },
  });

  if (!testRun || testRun.status === 'RUNNING') return;

  const isCI = testRun.source === 'CI';
  const isLocal = testRun.source === 'LOCAL' || testRun.source === 'MANUAL';

  // Build list of (title, status) from this run
  const runResults = testRun.results.map((r) => ({
    title: r.testCase.title,
    status: r.status as 'PASSED' | 'FAILED',
  }));

  if (runResults.length === 0) return;

  // Find active task groups to match against
  let taskGroups;

  if (isLocal) {
    // For local: match to task groups in the same team
    // Branch matching narrows the scope
    taskGroups = await prisma.taskGroup.findMany({
      where: {
        teamId: testRun.teamId,
        status: 'ACTIVE',
      },
      include: {
        items: {
          include: {
            libraryTestCase: { select: { title: true } },
          },
        },
      },
    });
  } else {
    // For CI: match to all active task groups in the team (possibly filtered by app)
    taskGroups = await prisma.taskGroup.findMany({
      where: {
        teamId: testRun.teamId,
        status: 'ACTIVE',
        ...(testRun.applicationId ? { applicationId: testRun.applicationId } : {}),
      },
      include: {
        items: {
          include: {
            libraryTestCase: { select: { title: true } },
          },
        },
      },
    });
  }

  const matches: MatchResult[] = [];

  for (const group of taskGroups) {
    for (const item of group.items) {
      const ltcTitle = item.libraryTestCase.title;

      // Find best matching test result from the run
      let bestMatch: { result: typeof runResults[0]; confidence: number; matchType: MatchResult['matchType'] } | null = null;

      const branchMatchType = getBranchMatchType(group.branch, testRun.branch);

      for (const runResult of runResults) {
        const sim = diceSimilarity(ltcTitle, runResult.title);

        let confidence = 0;
        let matchType: MatchResult['matchType'] = 'title_only';
        let threshold = 90; // title-only threshold (higher)

        if (branchMatchType === 'exact') {
          threshold = 85;
          if (sim >= threshold) {
            confidence = sim + 15; // boost for branch exact match
            matchType = 'branch_exact';
          }
        } else if (branchMatchType === 'prefix') {
          threshold = 85;
          if (sim >= threshold) {
            confidence = sim + 5; // slight boost for branch prefix match
            matchType = 'branch_prefix';
          }
        } else {
          // No branch match — use higher threshold, title only
          if (sim >= threshold) {
            confidence = sim;
            matchType = 'title_only';
          }
        }

        if (confidence > 0 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = { result: runResult, confidence: Math.min(confidence, 100), matchType };
        }
      }

      if (bestMatch) {
        matches.push({
          taskGroupItemId: item.id,
          taskGroupId: group.id,
          taskGroupUserId: group.userId,
          testCaseTitle: ltcTitle,
          matchType: bestMatch.matchType,
          confidence: bestMatch.confidence,
          resultStatus: bestMatch.result.status,
          testRunId,
        });
      }
    }
  }

  if (matches.length === 0) return;

  // Apply matches
  const worksOnMyMachineAlerts: Array<{ item: { id: string; localResultStatus: string | null }; groupUserId: string; title: string; groupId: string }> = [];

  for (const match of matches) {
    if (isLocal) {
      // Check current state for "works on my machine" detection
      const currentItem = await prisma.taskGroupItem.findUnique({
        where: { id: match.taskGroupItemId },
        select: { id: true, envResultStatus: true, localResultStatus: true },
      });

      await prisma.taskGroupItem.update({
        where: { id: match.taskGroupItemId },
        data: {
          localResultStatus: match.resultStatus,
          localTestRunId: testRunId,
          localMatchedAt: new Date(),
          // If was NOT_STARTED, bump to IN_PROGRESS when test runs
          personalStatus:
            currentItem?.localResultStatus === null
              ? { set: 'IN_PROGRESS' }
              : undefined,
        },
      });
    } else {
      // CI run — update env status
      const currentItem = await prisma.taskGroupItem.findUnique({
        where: { id: match.taskGroupItemId },
        select: { id: true, localResultStatus: true, envResultStatus: true },
      });

      // Check for "works on my machine" condition
      if (
        currentItem?.localResultStatus === 'PASSED' &&
        match.resultStatus === 'FAILED'
      ) {
        worksOnMyMachineAlerts.push({
          item: currentItem,
          groupUserId: match.taskGroupUserId,
          title: match.testCaseTitle,
          groupId: match.taskGroupId,
        });
      }

      await prisma.taskGroupItem.update({
        where: { id: match.taskGroupItemId },
        data: {
          envResultStatus: match.resultStatus,
          envTestRunId: testRunId,
          envMatchedAt: new Date(),
        },
      });
    }
  }

  // Group updated items by task group for WS events
  const byGroup = new Map<string, typeof matches>();
  for (const m of matches) {
    const existing = byGroup.get(m.taskGroupId) ?? [];
    existing.push(m);
    byGroup.set(m.taskGroupId, existing);
  }

  for (const [groupId, groupMatches] of byGroup) {
    const group = taskGroups.find((g) => g.id === groupId);
    if (!group) continue;

    // Emit WS event to task group owner
    eventService.broadcast(testRun.teamId, 'task:items-updated', {
      taskGroupId: groupId,
      userId: group.userId,
      updatedItems: groupMatches.map((m) => ({
        itemId: m.taskGroupItemId,
        field: isCI ? 'envResultStatus' : 'localResultStatus',
        status: m.resultStatus,
      })),
    });

    // Check auto-complete
    const completed = await checkAndAutoComplete(groupId);
    if (completed) {
      eventService.broadcast(testRun.teamId, 'task:group-completed', {
        groupId: completed.id,
        groupName: completed.name,
        userId: completed.userId,
      });
    }
  }

  // Emit "works on my machine" alerts
  for (const alert of worksOnMyMachineAlerts) {
    eventService.broadcast(testRun.teamId, 'task:works-local-fails-staging', {
      userId: alert.groupUserId,
      itemId: alert.item.id,
      taskGroupId: alert.groupId,
      testCaseTitle: alert.title,
      testRunId,
    });
  }
}
