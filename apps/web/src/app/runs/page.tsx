'use client';

import { Suspense, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useRuns } from '@/hooks/use-runs';
import { useAppContext } from '@/providers/AppContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Pagination } from '@/components/Pagination';
import { RunSourceBadge } from '@/components/ui/run-source-badge';
import { BranchBadge } from '@/components/ui/branch-badge';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { StatusBar } from '@/components/ui/status-bar';
import { MiniSparkline } from '@/components/ui/mini-sparkline';
import { FilterChip } from '@/components/ui/filter-chip';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RunsSkeleton } from '@/components/skeletons';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { TestRun, RunSource, TestCase } from '@/lib/types';

// ── Helper Functions ──────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function viewToSource(view: string | null | undefined): string | undefined {
  if (view === 'ci') return 'CI';
  if (view === 'local') return 'LOCAL';
  return undefined;
}

// ── FailedTestsPreview sub-component ─────────────────────────────────────────

interface FailedTestResult {
  id: string;
  status: string;
  error?: string;
  testCase?: TestCase;
}

function FailedTestsPreview({ runId }: { runId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['run-failed-preview', runId],
    queryFn: () => api.getRun(runId, { status: 'FAILED', pageSize: 5 }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 mt-2 space-y-2">
        <p className="text-[11px] font-semibold text-red-500">Failed Tests</p>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2 items-center">
            <div className="w-2 h-2 rounded-full bg-red-500/30 animate-pulse shrink-0" />
            <div className="h-3 bg-muted/60 rounded animate-pulse flex-1" />
          </div>
        ))}
      </div>
    );
  }

  const failedResults = (data?.results?.data ?? []).filter(
    (r: FailedTestResult) => r.status === 'FAILED',
  );

  if (failedResults.length === 0) return null;

  return (
    <div className="bg-red-500/8 border border-red-500/20 rounded-lg p-3 mt-2">
      <p className="text-[11px] font-semibold text-red-500 mb-2">Failed Tests</p>
      <div className="space-y-1.5">
        {failedResults.map((result: FailedTestResult) => {
          const errorType = result.error
            ? result.error.split('\n')[0].slice(0, 60)
            : 'Assertion error';
          return (
            <div key={result.id} className="flex items-start gap-2">
              <span className="text-red-500 text-[11px] font-bold shrink-0 mt-0.5">✗</span>
              <span className="text-[11px] text-foreground/80 flex-1 min-w-0 truncate">
                {result.testCase?.title ?? 'Unknown test'}
              </span>
              <span className="text-[10px] text-red-400/70 shrink-0 ml-2 max-w-[120px] truncate">
                {errorType}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RunCard component ─────────────────────────────────────────────────────────

interface RunCardProps {
  run: TestRun;
  isExpanded: boolean;
  onToggle: () => void;
  sparklineData: number[];
  onNavigate: (id: string) => void;
}

function RunCard({ run, isExpanded, onToggle, sparklineData, onNavigate }: RunCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);

  const sparklineColor =
    run.status === 'PASSED'
      ? '#22c55e'
      : run.status === 'FAILED'
      ? '#ef4444'
      : '#64748b';

  const statusIcon = {
    PASSED: <span className="text-lg font-bold text-green-600 dark:text-green-400">✓</span>,
    FAILED: <span className="text-lg font-bold text-red-600 dark:text-red-400">✗</span>,
    RUNNING: (
      <span className="inline-block text-lg font-bold text-blue-600 animate-spin">↻</span>
    ),
    CANCELLED: (
      <span className="text-lg font-bold text-muted-foreground">—</span>
    ),
  }[run.status] ?? <span className="text-lg font-bold text-muted-foreground">?</span>;

  const statusBg = {
    PASSED: 'bg-green-500/15',
    FAILED: 'bg-red-500/15',
    RUNNING: 'bg-blue-500/15',
    CANCELLED: 'bg-muted',
  }[run.status] ?? 'bg-muted';

  return (
    <>
      <div
        className={cn(
          'bg-card border border-border rounded-xl transition-colors cursor-pointer',
          'hover:border-primary/30',
          isExpanded && 'border-primary/20',
        )}
        onClick={onToggle}
        onMouseEnter={() => {
          queryClient.prefetchQuery({
            queryKey: ['run', run.id, undefined],
            queryFn: () => api.getRun(run.id),
            staleTime: 10_000,
          });
        }}
      >
        {/* Main row */}
        <div className="flex items-center gap-3.5 p-3.5 px-4.5">
          {/* Status indicator */}
          <div
            className={cn(
              'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
              statusBg,
            )}
          >
            {statusIcon}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: team chip + run ID */}
            <div className="flex items-center gap-2">
              {run.team && (
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded border text-[11px] font-medium shrink-0',
                    teamColorClass(run.team.id),
                  )}
                >
                  {run.team.name}
                </span>
              )}
              <span className="font-mono text-[11px] text-muted-foreground truncate">
                {run.id.slice(0, 12)}
              </span>
            </div>

            {/* Row 2: badges + time */}
            <div className="flex gap-2 items-center mt-0.5 flex-wrap">
              <RunSourceBadge source={run.source as RunSource} size="sm" />
              {run.environment && <EnvironmentBadge environment={run.environment} />}
              {run.branch && <BranchBadge branch={run.branch} />}
              <span className="text-[11px] text-muted-foreground">
                {formatTimeAgo(run.startedAt)}
              </span>
            </div>
          </div>

          {/* Status distribution */}
          <div className="w-28 shrink-0">
            <div className="flex gap-2 text-[10px] font-semibold">
              {run.passed > 0 && (
                <span className="text-green-500">✓{run.passed}</span>
              )}
              {run.failed > 0 && (
                <span className="text-red-500">✗{run.failed}</span>
              )}
              {run.skipped > 0 && (
                <span className="text-muted-foreground">{run.skipped}skip</span>
              )}
            </div>
            <StatusBar
              passed={run.passed}
              failed={run.failed}
              skipped={run.skipped}
              total={run.totalTests}
              height={6}
              animated={true}
              className="mt-0.5"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {run.totalTests} tests
            </p>
          </div>

          {/* Sparkline */}
          <div className="shrink-0 text-center">
            <MiniSparkline
              data={sparklineData.length >= 2 ? sparklineData : [0, 0]}
              color={sparklineColor}
              width={60}
              height={20}
            />
            <p className="text-[9px] text-muted-foreground mt-0.5">trend</p>
          </div>

          {/* Duration + time */}
          <div className="text-right min-w-[65px] shrink-0">
            <p className="text-[12px] font-semibold text-foreground">
              {formatDuration(run.duration)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatTimeAgo(run.startedAt)}
            </p>
          </div>

          {/* Expand arrow */}
          <span
            className={cn(
              'text-muted-foreground ml-1 text-sm transition-transform duration-200 shrink-0',
              isExpanded && 'rotate-180',
            )}
          >
            ▾
          </span>
        </div>

        {/* Expanded area */}
        {isExpanded && (
          <div
            className="pt-3 px-4.5 pb-4 border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Actions row */}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => onNavigate(run.id)}
              >
                View Full Report →
              </button>

              {run.failed > 0 && (
                <SmartButton
                  variant="outline"
                  className="text-[12px] h-auto py-1.5 px-3 border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
                  onClick={async () => {
                    setRetryDialogOpen(true);
                  }}
                >
                  🔄 Retry Failed ({run.failed})
                </SmartButton>
              )}

              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium text-muted-foreground opacity-50 cursor-not-allowed"
              >
                📋 Compare
              </button>
            </div>

            {/* Failed tests preview */}
            {run.failed > 0 && <FailedTestsPreview runId={run.id} />}
          </div>
        )}
      </div>

      {/* Retry confirm dialog */}
      <ConfirmDialog
        open={retryDialogOpen}
        onOpenChange={setRetryDialogOpen}
        title="Retry Failed Tests"
        description={`This will re-run ${run.failed} failed tests. Results will be updated automatically.`}
        variant="warning"
        confirmText={`Open Run (${run.failed} failed)`}
        onConfirm={async () => {
          toast.info('Opening run to retry failed tests...');
          router.push(`/runs/${run.id}`);
        }}
      />
    </>
  );
}

// ── RunsPageContent ───────────────────────────────────────────────────────────

function RunsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedApp } = useAppContext();

  // URL params
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  const teamId = searchParams.get('teamId') ?? undefined;
  const source = searchParams.get('source') ?? undefined;
  const branch = searchParams.get('branch') ?? undefined;
  const environment = searchParams.get('environment') ?? undefined;
  const view = searchParams.get('view') ?? undefined;
  const search = searchParams.get('search') ?? '';

  // Expanded state per run
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  function onPageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/runs?${params.toString()}`);
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  function setView(newView: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (newView === undefined) {
      params.delete('view');
    } else {
      params.set('view', newView);
      // view overrides source for ci/local
      if (newView === 'ci' || newView === 'local') {
        params.delete('source');
      }
    }
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  function setSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set('search', value);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  // Fetch runs — view=ci/local overrides source param
  const { data, isLoading, prefetchNext } = useRuns({
    page,
    pageSize,
    teamId,
    source: viewToSource(view) ?? source,
    branch,
    environment,
    applicationId: selectedApp?.id,
  });

  const prefetchNextStable = useCallback(prefetchNext, [prefetchNext]);

  // Client-side filtering
  const allRuns: TestRun[] = data?.data ?? [];

  const filteredRuns = allRuns.filter((run) => {
    // view=failed: filter by status
    if (view === 'failed' && run.status !== 'FAILED') return false;
    // search: match run ID or team name
    if (search) {
      const q = search.toLowerCase();
      const matchesId = run.id.toLowerCase().includes(q);
      const matchesTeam = run.team?.name?.toLowerCase().includes(q) ?? false;
      if (!matchesId && !matchesTeam) return false;
    }
    return true;
  });

  // Summary metrics from current page
  const now = Date.now();
  const totalRuns24h = allRuns.filter(
    (r) => now - new Date(r.startedAt).getTime() < 86_400_000,
  ).length;
  const passedRuns = allRuns.filter((r) => r.status === 'PASSED').length;
  const passRate = allRuns.length > 0 ? Math.round((passedRuns / allRuns.length) * 100) : 0;
  const avgDuration =
    allRuns.length > 0
      ? allRuns.reduce((acc, r) => acc + (r.duration ?? 0), 0) / allRuns.length
      : 0;
  const activeFailed = allRuns.filter((r) => r.status === 'FAILED').length;

  // Filter chip counts
  const failedCount = allRuns.filter((r) => r.status === 'FAILED').length;
  const ciCount = allRuns.filter((r) => r.source === 'CI').length;
  const localCount = allRuns.filter((r) => r.source === 'LOCAL').length;

  // Build sparkline data per run: for each run, show passed counts from
  // same-team runs on the current page, sorted by startedAt ascending.
  const teamRunsMap = new Map<string, TestRun[]>();
  for (const run of allRuns) {
    const key = run.teamId;
    if (!teamRunsMap.has(key)) teamRunsMap.set(key, []);
    teamRunsMap.get(key)!.push(run);
  }
  // Sort each team's runs by startedAt ascending
  for (const [, runs] of teamRunsMap) {
    runs.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  }

  function getSparklineForRun(run: TestRun): number[] {
    const teamRuns = teamRunsMap.get(run.teamId) ?? [];
    return teamRuns.map((r) => r.passed);
  }

  const totalItems = data?.pagination.totalItems ?? 0;
  const mostRecentRun = allRuns[0];

  // Empty state flags
  const hasAnyRuns = !isLoading && allRuns.length === 0;
  const hasNoFilteredRuns = !isLoading && allRuns.length > 0 && filteredRuns.length === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold text-foreground">Test Runs</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isLoading ? (
            'Loading...'
          ) : (
            <>
              {totalItems} runs
              {mostRecentRun && (
                <> &bull; Last run {formatTimeAgo(mostRecentRun.startedAt)}</>
              )}
            </>
          )}
        </p>
      </div>

      {/* Summary cards */}
      {!isLoading && allRuns.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Runs 24h */}
          <div className="bg-card border border-border rounded-xl p-3.5 relative">
            <span className="absolute top-3 right-3.5 text-lg opacity-40">📊</span>
            <p className="text-[11px] font-medium text-muted-foreground">Total Runs (24h)</p>
            <p className="text-[22px] font-bold text-primary mt-0.5">{totalRuns24h}</p>
            <p className="text-[10px] text-muted-foreground">last 24h</p>
          </div>

          {/* Pass Rate */}
          <div className="bg-card border border-border rounded-xl p-3.5 relative">
            <span className="absolute top-3 right-3.5 text-lg opacity-40">✅</span>
            <p className="text-[11px] font-medium text-muted-foreground">Pass Rate</p>
            <p className="text-[22px] font-bold text-green-600 dark:text-green-400 mt-0.5">
              {passRate}%
            </p>
            <p className="text-[10px] text-green-600 dark:text-green-400">this page</p>
          </div>

          {/* Avg Duration */}
          <div className="bg-card border border-border rounded-xl p-3.5 relative">
            <span className="absolute top-3 right-3.5 text-lg opacity-40">⏱️</span>
            <p className="text-[11px] font-medium text-muted-foreground">Avg Duration</p>
            <p className="text-[22px] font-bold text-yellow-600 dark:text-yellow-400 mt-0.5">
              {formatDuration(avgDuration)}
            </p>
            <p className="text-[10px] text-muted-foreground">this page</p>
          </div>

          {/* Active Failures */}
          <div className="bg-card border border-border rounded-xl p-3.5 relative">
            <span className="absolute top-3 right-3.5 text-lg opacity-40">🔴</span>
            <p className="text-[11px] font-medium text-muted-foreground">Active Failures</p>
            <p className="text-[22px] font-bold text-red-500 mt-0.5">{activeFailed}</p>
            <p className="text-[10px] text-red-500">
              {activeFailed} run{activeFailed !== 1 ? 's' : ''} affected
            </p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter chips */}
        <FilterChip
          label="All Runs"
          active={!view}
          count={allRuns.length}
          onClick={() => setView(undefined)}
        />
        <FilterChip
          label="Failed"
          active={view === 'failed'}
          count={failedCount}
          icon="✗"
          onClick={() => setView('failed')}
        />
        <FilterChip
          label="CI / Pipeline"
          active={view === 'ci'}
          count={ciCount}
          icon="⚙️"
          onClick={() => setView('ci')}
        />
        <FilterChip
          label="Local"
          active={view === 'local'}
          count={localCount}
          icon="🖥️"
          onClick={() => setView('local')}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search runs, branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-52 pl-8 pr-3 py-[6px] text-[12px] rounded-full border border-border',
              'bg-card text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40',
              'transition-colors',
            )}
          />
        </div>
      </div>

      {/* Run cards */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-3.5 px-4.5 animate-pulse"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-[10px] bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-40" />
                  <div className="h-3 bg-muted rounded w-64" />
                </div>
                <div className="w-28 space-y-1.5 shrink-0">
                  <div className="h-2.5 bg-muted rounded w-20" />
                  <div className="h-1.5 bg-muted rounded-full w-full" />
                </div>
                <div className="w-16 h-5 bg-muted rounded shrink-0" />
                <div className="w-16 space-y-1 shrink-0 text-right">
                  <div className="h-3 bg-muted rounded w-12 ml-auto" />
                  <div className="h-3 bg-muted rounded w-10 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : hasAnyRuns ? (
        /* No runs at all */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[15px] font-semibold text-foreground mb-1">No test runs yet</p>
          <p className="text-[13px] text-muted-foreground max-w-xs">
            Set up the SDK and run your first test.
          </p>
        </div>
      ) : hasNoFilteredRuns ? (
        /* Filter / search returned empty */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {search ? (
            <>
              <p className="text-[15px] font-semibold text-foreground mb-1">
                No runs matching &ldquo;{search}&rdquo;
              </p>
              <button
                type="button"
                className="mt-3 text-[12px] text-primary hover:underline"
                onClick={() => setSearch('')}
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-foreground mb-1">
                No {view === 'failed' ? 'failed' : view === 'ci' ? 'CI' : view === 'local' ? 'local' : ''} runs found.
              </p>
              <button
                type="button"
                className="mt-3 text-[12px] text-primary hover:underline"
                onClick={() => setView(undefined)}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRuns.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              isExpanded={expandedIds.has(run.id)}
              onToggle={() => toggleExpanded(run.id)}
              sparklineData={getSparklineForRun(run)}
              onNavigate={(id) => router.push(`/runs/${id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          pageSize={data.pagination.pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onPrefetchNext={prefetchNextStable}
        />
      )}
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function RunsPage() {
  return (
    <Suspense fallback={<RunsSkeleton />}>
      <RunsPageContent />
    </Suspense>
  );
}
