'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTestCase } from '@/hooks/use-test-cases';
import { RetryButton } from '@/components/RetryButton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Artifact } from '@/lib/types';

// ── Helper functions ──────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimeAgo(iso?: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function detectFlaky(statuses: string[]): boolean {
  // 3+ alternations in last 8 = flaky
  let alternations = 0;
  for (let i = 1; i < statuses.length; i++) {
    if (statuses[i] !== statuses[i - 1]) alternations++;
  }
  return alternations >= 3;
}

function getSmartHint(error: string): string | null {
  if (/timeout/i.test(error))
    return 'The element might not be rendered yet. Consider adding a waitFor before the action.';
  if (/assertion|expected.*received|toEqual|toBe/i.test(error))
    return "Expected value doesn't match. Check if the API response format changed.";
  if (/navigation|ERR_|net::|failed to load/i.test(error))
    return 'Page might not have loaded. Check network conditions.';
  if (/not found|no element|unable to find|locator/i.test(error))
    return 'Selector might have changed. Verify the element exists on the page.';
  return null;
}

function getErrorType(error: string): string {
  const match = error.match(/^(\w+Error)/);
  return match ? match[1] : 'Error';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TestCaseDetailSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-48 bg-muted rounded" />
      {/* Header card */}
      <div className="bg-card border border-border rounded-[14px] p-5 px-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-muted shrink-0" />
              <div className="h-6 w-64 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="h-8 w-16 bg-muted rounded-md shrink-0" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-background rounded-lg p-3 text-center border border-border/50">
              <div className="h-7 w-12 bg-muted rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-muted rounded mx-auto" />
            </div>
          ))}
        </div>
        {/* History bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-40 bg-muted rounded" />
          <div className="flex gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-1 h-7 bg-muted rounded-[4px]" />
            ))}
          </div>
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex gap-6 border-b border-border pb-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-20 bg-muted rounded" />
        ))}
      </div>
      {/* Content */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-5/6 bg-muted rounded" />
        <div className="h-4 w-4/6 bg-muted rounded" />
        <div className="h-32 w-full bg-muted rounded-lg mt-4" />
      </div>
    </div>
  );
}

// ── ArtifactCard ──────────────────────────────────────────────────────────────

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const { toast } = useToast();
  const icon =
    artifact.type === 'SCREENSHOT' ? '📸' : artifact.type === 'VIDEO' ? '🎥' : '📊';
  const url = api.artifactProxyUrl(artifact.id);

  function formatFileSize(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-card border border-border rounded-xl p-4 text-center hover:border-primary/40 transition-colors block"
      onClick={() => toast.info(`Opening ${artifact.fileName}...`)}
    >
      <p className="text-[28px] mb-2">{icon}</p>
      <p className="text-[12px] font-semibold text-foreground">{artifact.type}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{artifact.fileName}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{formatFileSize(artifact.fileSize)}</p>
    </a>
  );
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type TabId = 'error' | 'steps' | 'artifacts' | 'console';

const tabs: { id: TabId; icon: string; label: string }[] = [
  { id: 'error', icon: '🐛', label: 'Error & Stack' },
  { id: 'steps', icon: '📋', label: 'Steps' },
  { id: 'artifacts', icon: '📸', label: 'Artifacts' },
  { id: 'console', icon: '💻', label: 'Console' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TestCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useTestCase(id);
  const { toast } = useToast();
  const [retryOpen, setRetryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('error');

  // Sort results newest first
  const sortedResults = useMemo(
    () =>
      [...(data?.results ?? [])].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [data?.results],
  );

  // Latest result (most recent run)
  const latestResult = sortedResults[0];

  // Last 8 for history bar (newest last in display = oldest first)
  const last8 = sortedResults.slice(0, 8).reverse();

  // Health stats from all results
  const passedCount = sortedResults.filter((r) => r.status === 'PASSED').length;
  const failedCount = sortedResults.filter((r) => r.status === 'FAILED').length;
  const totalCount = sortedResults.length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  const avgDuration =
    totalCount > 0
      ? sortedResults.reduce((acc, r) => acc + (r.duration ?? 0), 0) / totalCount
      : 0;
  const totalRetries = sortedResults.reduce((acc, r) => acc + r.retryCount, 0);
  const isFlaky = detectFlaky(sortedResults.slice(0, 8).map((r) => r.status));

  const passRateColor =
    passRate >= 90 ? 'text-green-500' : passRate >= 70 ? 'text-yellow-500' : 'text-red-500';

  // All artifacts across all results
  const allArtifacts = sortedResults.flatMap((r) => r.artifacts ?? []);

  // Status dot color based on latest result
  const statusDotColor =
    latestResult?.status === 'PASSED'
      ? 'bg-green-500'
      : latestResult?.status === 'FAILED'
        ? 'bg-red-500'
        : latestResult?.status === 'SKIPPED'
          ? 'bg-yellow-500'
          : 'bg-muted-foreground/40';

  // Keyboard shortcuts
  useKeyboardShortcut('r', () => setRetryOpen(true));
  useKeyboardShortcut('arrowleft', () => router.push('/test-cases'));
  useKeyboardShortcut('1', () => setActiveTab('error'));
  useKeyboardShortcut('2', () => setActiveTab('steps'));
  useKeyboardShortcut('3', () => setActiveTab('artifacts'));
  useKeyboardShortcut('4', () => setActiveTab('console'));

  if (isLoading) {
    return <TestCaseDetailSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Test case not found</p>
        <button
          onClick={() => router.push('/test-cases')}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Back to test cases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 2a. Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <button
          onClick={() => router.push('/test-cases')}
          className="text-primary hover:underline"
        >
          Test Cases
        </button>
        <span>/</span>
        {data.suiteName && (
          <>
            <span className="truncate max-w-[120px]">{data.suiteName}</span>
            <span>/</span>
          </>
        )}
        <span className="font-mono">{data.id.slice(0, 8)}</span>
      </nav>

      {/* 2b. Header Card */}
      <div className="bg-card border border-border rounded-[14px] p-5 px-6 space-y-4">
        {/* Top section */}
        <div className="flex justify-between gap-4">
          {/* Left */}
          <div className="min-w-0 flex-1">
            {/* Row 1 */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={cn('w-3 h-3 rounded-full shrink-0', statusDotColor)}
              />
              <span className="text-[17px] font-bold text-foreground">{data.title}</span>
              <span className="font-mono text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {data.id.slice(0, 8)}
              </span>
            </div>
            {/* Row 2 */}
            <div className="flex gap-2.5 mt-1.5 text-[12px] text-muted-foreground flex-wrap items-center">
              <span>⏱️ {formatDuration(latestResult?.duration)}</span>
              <span>🕐 {formatTimeAgo(latestResult?.startedAt)}</span>
              <span className="font-mono text-[11px] truncate max-w-[200px] bg-muted px-1.5 py-0.5 rounded">
                {data.filePath}
              </span>
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-muted px-1.5 py-0.5 rounded text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {/* Right */}
          <div className="shrink-0">
            <RetryButton testCaseId={data.id} teamId={data.teamId} />
          </div>
        </div>

        {/* Health Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/50">
          {/* Pass Rate */}
          <div className="bg-background rounded-lg p-3 text-center border border-border/50">
            <p className={cn('text-[18px] font-bold', passRateColor)}>{passRate}%</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Pass Rate</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {passedCount}/{totalCount} recent
            </p>
          </div>
          {/* Avg Duration */}
          <div className="bg-background rounded-lg p-3 text-center border border-border/50">
            <p className="text-[18px] font-bold text-foreground">
              {formatDuration(Math.round(avgDuration))}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Avg Duration</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">per run</p>
          </div>
          {/* Retries */}
          <div className="bg-background rounded-lg p-3 text-center border border-border/50">
            <p
              className={cn(
                'text-[18px] font-bold',
                totalRetries > 0 ? 'text-orange-500' : 'text-foreground',
              )}
            >
              {totalRetries}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Retries</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">total</p>
          </div>
          {/* Flaky */}
          <div className="bg-background rounded-lg p-3 text-center border border-border/50">
            <p
              className={cn(
                'text-[18px] font-bold',
                isFlaky ? 'text-purple-500' : 'text-green-500',
              )}
            >
              {isFlaky ? 'Yes' : 'No'}
            </p>
            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">Flaky</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {isFlaky ? 'unstable pattern' : 'stable'}
            </p>
          </div>
        </div>

        {/* Run History Bar */}
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground font-medium mb-2">
            Recent History ({Math.min(sortedResults.length, 8)} runs)
          </p>
          <div className="flex gap-1.5">
            {last8.map((result) => {
              const isPass = result.status === 'PASSED';
              const isFail = result.status === 'FAILED';
              return (
                <button
                  key={result.id}
                  onClick={() => router.push(`/runs/${result.testRunId}`)}
                  title={`${result.status} — ${formatTimeAgo(result.startedAt)}`}
                  className={cn(
                    'flex-1 h-7 rounded-[4px] flex items-center justify-center text-[12px] font-semibold transition-opacity hover:opacity-80',
                    isPass &&
                      'bg-green-500/15 border border-green-500/30 text-green-600 dark:text-green-400',
                    isFail &&
                      'bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400',
                    !isPass &&
                      !isFail &&
                      'bg-yellow-500/15 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
                  )}
                >
                  {isPass ? '✓' : isFail ? '✗' : '—'}
                </button>
              );
            })}
            {/* Pad with empty blocks if < 8 */}
            {Array.from({ length: Math.max(0, 8 - last8.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex-1 h-7 rounded-[4px] bg-muted/30 border border-border/20"
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
            <span>{last8.length} runs ago</span>
            <span>latest</span>
          </div>
        </div>
      </div>

      {/* 2c. Content Tabs */}
      <div className="flex border-b border-border gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 pb-2.5 text-[13px] border-b-2 transition-colors',
              activeTab === tab.id
                ? 'font-semibold text-primary border-primary'
                : 'font-normal text-muted-foreground border-transparent hover:text-foreground',
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {/* 2d. Error & Stack */}
        {activeTab === 'error' && (
          <>
            {!latestResult?.error ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-[13px]">
                No errors recorded. The latest run passed ✓
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Error summary — red tinted header */}
                <div className="bg-red-500/8 border-b border-red-500/20 px-5 py-4">
                  <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">
                    {getErrorType(latestResult.error)}
                  </p>
                  <p className="text-[12px] text-red-500/80 dark:text-red-400/70 mt-1 leading-relaxed">
                    {latestResult.error.split('\n')[0]}
                  </p>
                </div>

                {/* Stack trace */}
                <div className="px-5 py-4">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2">
                    Stack Trace
                  </p>
                  <pre className="text-[11px] font-mono text-muted-foreground leading-[1.7] whitespace-pre-wrap break-all">
                    {latestResult.error}
                  </pre>
                </div>

                {/* Smart hint */}
                {getSmartHint(latestResult.error) && (
                  <div className="mx-5 mb-4 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-primary">
                      💡 <strong>Hint:</strong> {getSmartHint(latestResult.error)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 2e. Steps */}
        {activeTab === 'steps' && (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-[28px] mb-3">📋</p>
            <p className="text-[14px] font-medium text-foreground mb-1">
              Step-by-step data not available
            </p>
            <p className="text-[12px] text-muted-foreground max-w-sm mx-auto">
              Enable{' '}
              <code className="bg-muted px-1 rounded">trace: &apos;on&apos;</code> in Playwright
              config to capture execution steps.
            </p>
          </div>
        )}

        {/* 2f. Artifacts */}
        {activeTab === 'artifacts' && (
          <>
            {allArtifacts.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <p className="text-[28px] mb-3">📸</p>
                <p className="text-[14px] font-medium text-foreground mb-1">
                  No artifacts recorded
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Enable screenshots and video in Playwright config.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {allArtifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 2g. Console */}
        {activeTab === 'console' && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-center py-8">
              <p className="text-[28px] mb-3">💻</p>
              <p className="text-[14px] font-medium text-foreground mb-1">
                Console logs not available
              </p>
              <p className="text-[12px] text-muted-foreground">
                Enable verbose logging in your test configuration.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-3 pt-4 border-t border-border/50">
        <button
          onClick={() => router.push('/test-cases')}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Test Cases
        </button>
        <div className="flex-1" />
        <RetryButton testCaseId={data.id} teamId={data.teamId} />
      </div>

      {/* Confirm Dialog for Retry */}
      <ConfirmDialog
        open={retryOpen}
        onOpenChange={setRetryOpen}
        title="Retry Test"
        description={`This will re-run "${data.title}". Results will be updated automatically.`}
        variant="warning"
        confirmText="Retry Test"
        onConfirm={async () => {
          await api.requestRetry(data.id, data.teamId);
          toast.info('Retry queued — watcher will pick it up shortly');
        }}
      />
    </div>
  );
}
