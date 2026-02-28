'use client';

import { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Video,
  FileText,
  Download,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Share2,
  ArrowLeft,
} from 'lucide-react';
import { useRun, useRunResultsGrouped } from '@/hooks/use-runs';
import { StatusBadge } from '@/components/status-badge';
import { ScreenshotViewer } from '@/components/ScreenshotViewer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Pagination } from '@/components/Pagination';
import { InnerPagination } from '@/components/InnerPagination';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { RetryButton } from '@/components/RetryButton';
import { RunSourceBadge } from '@/components/ui/run-source-badge';
import { BranchBadge } from '@/components/ui/branch-badge';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
import { StatusBar } from '@/components/ui/status-bar';
import { FilterChip } from '@/components/ui/filter-chip';
import { HistoryDots } from '@/components/ui/history-dots';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/hooks/use-toast';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { RunDetailSkeleton } from '@/components/skeletons';
import type { Artifact, TestStatus, RunResultGroup, RunSource } from '@/lib/types';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | TestStatus;
type GroupByMode = 'none' | 'suite';

type ResultRow = {
  id: string;
  testCaseId: string;
  status: TestStatus;
  duration?: number;
  error?: string;
  retryCount: number;
  artifacts: Artifact[];
  testCase?: { id: string; title: string; filePath: string; suiteName?: string };
};

// ── Utility functions ──────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
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
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getRunStatusIcon(status: string): { bg: string; text: string; symbol: string } {
  switch (status) {
    case 'PASSED':    return { bg: 'bg-green-500/15',  text: 'text-green-500',  symbol: '✓' };
    case 'FAILED':    return { bg: 'bg-red-500/15',    text: 'text-red-500',    symbol: '✗' };
    case 'RUNNING':   return { bg: 'bg-blue-500/15',   text: 'text-blue-500',   symbol: '▶' };
    case 'CANCELLED': return { bg: 'bg-muted',          text: 'text-muted-foreground', symbol: '●' };
    default:          return { bg: 'bg-muted',          text: 'text-muted-foreground', symbol: '?' };
  }
}

// ── ArtifactButtons ────────────────────────────────────────────────────────────

function ArtifactButtons({
  artifacts,
  onScreenshot,
  onVideo,
}: {
  artifacts: Artifact[];
  onScreenshot: (artifact: Artifact) => void;
  onVideo: (artifact: Artifact) => void;
}) {
  const screenshots = artifacts.filter((a) => a.type === 'SCREENSHOT');
  const videos = artifacts.filter((a) => a.type === 'VIDEO');
  const logs = artifacts.filter((a) => a.type === 'TRACE' || a.type === 'LOG');

  return (
    <div className="flex items-center gap-1">
      {screenshots.map((a) => (
        <button
          key={a.id}
          title="View screenshot"
          onClick={(e) => { e.stopPropagation(); onScreenshot(a); }}
          className="p-1 rounded text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted transition-colors"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      ))}
      {videos.map((a) => (
        <button
          key={a.id}
          title="Play video"
          onClick={(e) => { e.stopPropagation(); onVideo(a); }}
          className="p-1 rounded text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 hover:bg-muted transition-colors"
        >
          <Video className="h-3.5 w-3.5" />
        </button>
      ))}
      {logs.map((a) => (
        <a
          key={a.id}
          href={api.artifactProxyUrl(a.id)}
          download={a.fileName}
          title={`Download ${a.type.toLowerCase()}`}
          className="p-1 rounded text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-muted transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {a.type === 'TRACE' ? (
            <FileText className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </a>
      ))}
      {artifacts.length === 0 && (
        <span className="text-muted-foreground/40 text-[10px]">—</span>
      )}
    </div>
  );
}

// ── ResultsTable (flat view) ───────────────────────────────────────────────────

function ResultsTable({
  results,
  teamId,
  onErrorClick,
  onScreenshot,
  onVideo,
}: {
  results: ResultRow[];
  teamId: string;
  onErrorClick: (err: string) => void;
  onScreenshot: (a: Artifact, title: string) => void;
  onVideo: (a: Artifact, title: string) => void;
}) {
  if (results.length === 0) {
    return (
      <TableRow className="border-border">
        <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
          No results match the current filter
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {results.map((result) => {
        const title = result.testCase?.title ?? result.testCaseId;
        return (
          <TableRow key={result.id} className="border-border hover:bg-muted/40">
            <TableCell className="text-foreground/90 text-sm max-w-xs">
              <div className="truncate" title={title}>{title}</div>
              {result.testCase?.filePath && (
                <div className="text-muted-foreground text-xs mt-0.5 truncate">
                  {result.testCase.filePath}
                </div>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">
              {result.testCase?.suiteName ?? '—'}
            </TableCell>
            <TableCell>
              <StatusBadge status={result.status} type="test" />
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDuration(result.duration)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {result.retryCount > 0 ? (
                <span className="text-yellow-600 dark:text-yellow-400">{result.retryCount}</span>
              ) : (
                '0'
              )}
            </TableCell>
            <TableCell>
              <ArtifactButtons
                artifacts={result.artifacts ?? []}
                onScreenshot={(a) => onScreenshot(a, title)}
                onVideo={(a) => onVideo(a, title)}
              />
            </TableCell>
            <TableCell>
              {result.error ? (
                <button
                  className="text-left text-xs text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 transition-colors max-w-[180px] block"
                  onClick={() => onErrorClick(result.error!)}
                >
                  <span className="truncate block">
                    {(result.error.split('\n')[0] ?? result.error).slice(0, 60)}
                    {result.error.length > 60 ? '…' : ''}
                  </span>
                </button>
              ) : (
                <span className="text-muted-foreground/60 text-xs">—</span>
              )}
            </TableCell>
            <TableCell>
              {result.status === 'FAILED' && result.testCaseId && (
                <RetryButton testCaseId={result.testCaseId} teamId={teamId} />
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

// ── Suite Accordion (redesigned) ───────────────────────────────────────────────

function RunSuiteGroup({
  group,
  outerPage,
  teamId,
  totalSuites,
  onErrorClick,
  onScreenshot,
  onVideo,
}: {
  group: RunResultGroup;
  outerPage: number;
  teamId: string;
  totalSuites: number;
  onErrorClick: (err: string) => void;
  onScreenshot: (a: Artifact, title: string) => void;
  onVideo: (a: Artifact, title: string) => void;
}) {
  // Open by default if: has failures OR total suites <= 5
  const [open, setOpen] = useState(group.stats.failed > 0 || totalSuites <= 5);
  const [innerPage, setInnerPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setInnerPage(1);
    setShowAll(false);
  }, [outerPage]);

  const { stats } = group;
  const hasInnerPagination = (group.pagination?.totalPages ?? 1) > 1;
  const displayResults = group.results;
  const paginationMeta = group.pagination;

  // Inline error preview: first 3 failed results per suite
  const failedWithErrors = displayResults
    .filter((r) => r.status === 'FAILED' && r.error)
    .slice(0, 3);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Suite header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer select-none transition-colors',
          stats.failed > 0
            ? 'hover:bg-red-50 dark:hover:bg-red-950/20'
            : 'hover:bg-muted/40',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform" />
          )}
          <span className="text-[13px] font-semibold text-foreground truncate">
            {group.suiteName}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {stats.passed > 0 && (
            <span className="text-[12px] text-green-600 dark:text-green-400 font-medium">
              {stats.passed}✓
            </span>
          )}
          {stats.failed > 0 && (
            <span className="text-[12px] text-red-600 dark:text-red-400 font-medium">
              {stats.failed}✗
            </span>
          )}
          <StatusBar
            passed={stats.passed}
            failed={stats.failed}
            skipped={stats.skipped}
            total={stats.total}
            height={4}
            animated={false}
            className="w-14"
          />
          <span className="text-[11px] text-muted-foreground">{stats.total}</span>
        </div>
      </div>

      {/* Test rows */}
      {open && (
        <>
          <div className="divide-y divide-border/40">
            {displayResults.map((result) => {
              const title = result.testCase?.title ?? result.testCaseId;
              const isFlaky = result.retryCount > 0;

              let dotColor = 'bg-muted-foreground/40';
              if (result.status === 'PASSED') dotColor = 'bg-green-500';
              else if (result.status === 'FAILED') dotColor = 'bg-red-500';
              else if (result.status === 'SKIPPED') dotColor = 'bg-yellow-500';
              else if (result.status === 'RETRIED') dotColor = 'bg-purple-500';

              return (
                <div
                  key={result.id}
                  className="pl-10 pr-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 cursor-pointer border-border/0"
                  onClick={() => {
                    if (result.error) {
                      onErrorClick(result.error);
                    }
                  }}
                >
                  {/* Status dot */}
                  <div className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />

                  {/* Test title */}
                  <span
                    className="text-[12px] text-foreground/90 flex-1 truncate"
                    title={title}
                  >
                    {title}
                  </span>

                  {/* Flaky badge */}
                  {isFlaky && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                      ⚡ FLAKY
                    </span>
                  )}

                  {/* History dots (empty — single run context) */}
                  <HistoryDots history={[]} />

                  {/* Duration */}
                  <span className="text-[11px] text-muted-foreground min-w-[45px] text-right shrink-0">
                    {formatDuration(result.duration)}
                  </span>

                  {/* Retry count */}
                  {result.retryCount > 0 && (
                    <span className="text-[10px] text-orange-500 shrink-0">
                      🔄{result.retryCount}
                    </span>
                  )}

                  {/* Artifacts */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <ArtifactButtons
                      artifacts={result.artifacts ?? []}
                      onScreenshot={(a) => onScreenshot(a, title)}
                      onVideo={(a) => onVideo(a, title)}
                    />
                  </div>

                  {/* Retry button */}
                  {result.status === 'FAILED' && result.testCaseId && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <RetryButton testCaseId={result.testCaseId} teamId={teamId} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inline error previews for first 3 failed tests */}
          {failedWithErrors.length > 0 && (
            <div className="px-4 pb-3 space-y-2 mt-1">
              {failedWithErrors.map((result) => {
                const title = result.testCase?.title ?? result.testCaseId;
                const firstLine = (result.error ?? '').split('\n')[0] ?? result.error ?? '';
                return (
                  <div
                    key={`err-${result.id}`}
                    className="p-3 rounded-lg bg-red-500/[0.08] border border-red-500/20 cursor-pointer"
                    onClick={() => result.error && onErrorClick(result.error)}
                  >
                    <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1 truncate">
                      ✗ {title}
                    </p>
                    <p className="text-[11px] text-red-500/80 dark:text-red-400/70 font-mono break-words line-clamp-2">
                      {firstLine}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inner pagination */}
          {hasInnerPagination && !showAll && (
            <InnerPagination
              currentPage={innerPage}
              totalPages={paginationMeta?.totalPages ?? 1}
              totalItems={paginationMeta?.totalItems ?? displayResults.length}
              pageSize={paginationMeta?.pageSize ?? 5}
              onPageChange={setInnerPage}
              onShowAll={() => {
                setShowAll(true);
                setInnerPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Page content ───────────────────────────────────────────────────────────────

function RunDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  const statusParam = (searchParams.get('status') ?? 'all') as FilterStatus;
  const searchParam = searchParams.get('search') ?? '';
  // Default groupBy to 'suite' (changed from 'none')
  const groupBy = (searchParams.get('groupBy') ?? 'suite') as GroupByMode;

  const [searchInput, setSearchInput] = useState(searchParam);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [retryAllOpen, setRetryAllOpen] = useState(false);

  // Flat view data
  const { data: runDetail, isLoading } = useRun(id, {
    page,
    pageSize,
    status: statusParam !== 'all' ? statusParam : undefined,
    search: searchParam || undefined,
  });

  // Grouped view data
  const { data: groupedData, isLoading: groupedLoading } = useRunResultsGrouped(id, {
    page,
    pageSize,
    innerPageSize: 5,
    status: statusParam !== 'all' ? statusParam : undefined,
  });

  const [screenshotState, setScreenshotState] = useState<{
    screenshots: { url: string; title: string }[];
    index: number;
  } | null>(null);

  const [videoState, setVideoState] = useState<{ url: string; title: string } | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const allScreenshots = useMemo(() => {
    if (!runDetail?.results?.data) return [] as { url: string; title: string; artifactId: string }[];
    return runDetail.results.data.flatMap((r) =>
      (r.artifacts ?? [])
        .filter((a) => a.type === 'SCREENSHOT')
        .map((a) => ({
          url: api.artifactProxyUrl(a.id),
          title: r.testCase?.title ?? 'Screenshot',
          artifactId: a.id,
        }))
    );
  }, [runDetail?.results?.data]);

  function openScreenshot(artifact: Artifact) {
    const idx = allScreenshots.findIndex((s) => s.artifactId === artifact.id);
    setScreenshotState({ screenshots: allScreenshots, index: idx >= 0 ? idx : 0 });
  }

  function openVideo(artifact: Artifact, title: string) {
    setVideoState({ url: api.artifactProxyUrl(artifact.id), title });
  }

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v); else params.delete(k);
    }
    router.push(`/runs/${id}?${params.toString()}`);
  }

  function onStatusFilter(val: FilterStatus) {
    pushParams({ status: val === 'all' ? '' : val, page: '1' });
  }

  function onGroupByChange(val: GroupByMode) {
    pushParams({ groupBy: val === 'none' ? '' : val, page: '1' });
  }

  function onPageChange(p: number) {
    pushParams({ page: String(p) });
  }

  function onPageSizeChange(ps: number) {
    pushParams({ pageSize: String(ps), page: '1' });
  }

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      pushParams({ search: searchInput, page: '1' });
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Keyboard shortcuts
  useKeyboardShortcut('r', useCallback(() => {
    if (run && run.failed > 0) setRetryAllOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* run captured below */]));

  useKeyboardShortcut('arrowleft', useCallback(() => {
    router.push('/runs');
  }, [router]));

  useKeyboardShortcut('/', useCallback(() => {
    searchInputRef.current?.focus();
  }, []), { preventDefault: true });

  if (isLoading && !runDetail) return <RunDetailSkeleton />;

  const run = runDetail?.run;

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Run not found</p>
        <Link href="/runs" className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Back to runs
        </Link>
      </div>
    );
  }

  const resultsPagination = runDetail.results.pagination;
  const isGroupedLoading = groupBy === 'suite' && groupedLoading && !groupedData;

  // Compute flaky count: results with retryCount > 0
  const flakyCount = useMemo(() => {
    if (!runDetail?.results?.data) return 0;
    return runDetail.results.data.filter((r) => r.retryCount > 0).length;
  }, [runDetail?.results?.data]);

  const statusIcon = getRunStatusIcon(run.status);

  return (
    <>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <button
            onClick={() => router.push('/runs')}
            className="text-primary hover:underline"
          >
            Test Runs
          </button>
          <span>/</span>
          <span className="font-mono">{run.id.slice(0, 8)}</span>
        </nav>

        {/* Run Header Card */}
        <div className="bg-card border border-border rounded-[14px] p-5 px-6 space-y-4">
          {/* Top section */}
          <div className="flex items-start justify-between gap-4">
            {/* Left side */}
            <div className="min-w-0">
              {/* Row 1: status icon + run name + ID chip */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div
                  className={cn(
                    'w-7 h-7 rounded-[8px] flex items-center justify-center text-[14px] font-bold shrink-0',
                    statusIcon.bg,
                    statusIcon.text,
                  )}
                >
                  {statusIcon.symbol}
                </div>
                <h1 className="text-[18px] font-bold text-foreground leading-tight">
                  Run #{run.id.slice(0, 8)}
                </h1>
                <span className="font-mono text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {run.id.slice(0, 8)}
                </span>
              </div>

              {/* Row 2: badges + meta */}
              <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[12px] text-muted-foreground">
                {run.source && (
                  <RunSourceBadge source={run.source as RunSource} size="sm" />
                )}
                {run.environment && (
                  <EnvironmentBadge environment={run.environment} />
                )}
                {run.branch && (
                  <BranchBadge branch={run.branch} />
                )}
                <span>{formatTimeAgo(run.startedAt)}</span>
                {run.duration && (
                  <span>{formatDuration(run.duration)}</span>
                )}
                {run.team && (
                  <span className="bg-muted px-2 py-0.5 rounded text-[11px]">
                    {run.team.name}
                  </span>
                )}
              </div>
            </div>

            {/* Right side: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/runs')}
                className="gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              {run.failed > 0 && (
                <SmartButton
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={async () => { setRetryAllOpen(true); }}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950/30"
                >
                  Retry Failed ({run.failed})
                </SmartButton>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: run.totalTests, cls: 'text-foreground' },
              { label: 'Passed', value: run.passed, cls: 'text-green-500' },
              { label: 'Failed', value: run.failed, cls: 'text-red-500' },
              { label: 'Skipped', value: run.skipped, cls: 'text-yellow-500' },
              { label: 'Flaky', value: flakyCount, cls: 'text-purple-500' },
            ].map(({ label, value, cls }) => (
              <div
                key={label}
                className="bg-background rounded-lg p-2.5 text-center border border-border/50"
              >
                <p className={cn('text-[20px] font-bold', cls)}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Status bar */}
          {run.totalTests > 0 && (
            <StatusBar
              passed={run.passed}
              failed={run.failed}
              skipped={run.skipped}
              total={run.totalTests}
              height={8}
              showLabels={true}
            />
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterChip
              label="All"
              active={statusParam === 'all'}
              onClick={() => onStatusFilter('all')}
              count={resultsPagination.totalItems}
            />
            <FilterChip
              label="Passed"
              active={statusParam === 'PASSED'}
              onClick={() => onStatusFilter('PASSED')}
              count={run.passed}
            />
            <FilterChip
              label="Failed"
              active={statusParam === 'FAILED'}
              onClick={() => onStatusFilter('FAILED')}
              count={run.failed}
              icon="✗"
            />
            <FilterChip
              label="Skipped"
              active={statusParam === 'SKIPPED'}
              onClick={() => onStatusFilter('SKIPPED')}
              count={run.skipped}
            />
          </div>

          {/* Search */}
          <Input
            ref={searchInputRef}
            placeholder="Search by title… (/)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-52 bg-card border-border text-foreground placeholder:text-muted-foreground h-8 text-sm"
          />

          {/* Group by */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Group by:</span>
            <Select value={groupBy} onValueChange={onGroupByChange}>
              <SelectTrigger className="w-28 bg-card border-border text-foreground h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="suite" className="focus:bg-muted">Suite</SelectItem>
                <SelectItem value="none" className="focus:bg-muted">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results — grouped by suite */}
        {groupBy === 'suite' ? (
          <div className="space-y-2.5">
            {isGroupedLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 bg-muted rounded-xl" />
                ))}
              </div>
            ) : groupedData ? (
              <>
                <div className="space-y-2.5">
                  {groupedData.groups.map((group) => (
                    <RunSuiteGroup
                      key={`${group.suiteName}-${page}`}
                      group={group}
                      outerPage={page}
                      teamId={run.teamId}
                      totalSuites={groupedData.groups.length}
                      onErrorClick={setErrorModal}
                      onScreenshot={openScreenshot}
                      onVideo={openVideo}
                    />
                  ))}
                  {groupedData.groups.length === 0 && (
                    <div className="text-center text-muted-foreground py-12 bg-card border border-border rounded-xl">
                      No results found
                    </div>
                  )}
                </div>
                <Pagination
                  currentPage={groupedData.pagination.page}
                  totalPages={groupedData.pagination.totalPages}
                  totalItems={groupedData.pagination.totalItems}
                  pageSize={groupedData.pagination.pageSize}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            ) : null}
          </div>
        ) : (
          /* Results — flat paginated table */
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-[14px] font-semibold text-foreground">
                  Results{' '}
                  <span className="text-muted-foreground font-normal text-sm">
                    ({resultsPagination.totalItems})
                  </span>
                </h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Test Case</TableHead>
                    <TableHead className="text-muted-foreground">Suite</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Duration</TableHead>
                    <TableHead className="text-muted-foreground">Retries</TableHead>
                    <TableHead className="text-muted-foreground">Artifacts</TableHead>
                    <TableHead className="text-muted-foreground">Error</TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-20 bg-muted" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <ResultsTable
                      results={runDetail.results.data as ResultRow[]}
                      teamId={run.teamId}
                      onErrorClick={setErrorModal}
                      onScreenshot={openScreenshot}
                      onVideo={openVideo}
                    />
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination (flat view only) */}
        {groupBy === 'none' && (
          <Pagination
            currentPage={resultsPagination.page}
            totalPages={resultsPagination.totalPages}
            totalItems={resultsPagination.totalItems}
            pageSize={resultsPagination.pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        )}

        {/* Bottom actions */}
        <div className="flex gap-3 flex-wrap pt-1 border-t border-border/50">
          <SmartButton
            variant="outline"
            size="sm"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={async () => { setRetryAllOpen(true); }}
            disabled={run.failed === 0}
            disabledReason="No failed tests to retry"
          >
            Retry All Failed Tests
          </SmartButton>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success('Run URL copied!');
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Run
          </Button>
        </div>

        {/* Run metadata footer */}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-4 pb-2">
          <span>Started: {formatDate(run.startedAt)}</span>
          {run.finishedAt && <span>Finished: {formatDate(run.finishedAt)}</span>}
          <span className="font-mono">ID: {run.id}</span>
        </div>
      </div>

      {/* Retry All confirm dialog */}
      <ConfirmDialog
        open={retryAllOpen}
        onOpenChange={setRetryAllOpen}
        title="Retry Failed Tests"
        description={`This will re-run ${run.failed} failed test${run.failed === 1 ? '' : 's'} for this run. A new test run will be created with only the failed tests.`}
        variant="warning"
        confirmText={`Retry ${run.failed} Test${run.failed === 1 ? '' : 's'}`}
        onConfirm={async () => {
          toast.info(`Retrying ${run.failed} failed test${run.failed === 1 ? '' : 's'}...`);
        }}
      />

      {/* Error modal */}
      <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
        <DialogContent className="bg-card border-border max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="text-foreground">Error Details</DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-auto rounded-md bg-background border border-border p-4">
            <pre className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
              {errorModal}
            </pre>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screenshot viewer */}
      {screenshotState && (
        <ScreenshotViewer
          screenshots={screenshotState.screenshots}
          initialIndex={screenshotState.index}
          onClose={() => setScreenshotState(null)}
        />
      )}

      {/* Video player */}
      {videoState && (
        <VideoPlayer
          url={videoState.url}
          title={videoState.title}
          onClose={() => setVideoState(null)}
        />
      )}
    </>
  );
}

export default function RunDetailPage() {
  return (
    <Suspense fallback={<RunDetailSkeleton />}>
      <RunDetailContent />
    </Suspense>
  );
}
