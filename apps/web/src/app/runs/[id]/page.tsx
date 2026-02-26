'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Video,
  FileText,
  Download,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useRun, useRunResultsGrouped } from '@/hooks/use-runs';
import { StatusBadge } from '@/components/status-badge';
import { ScreenshotViewer } from '@/components/ScreenshotViewer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Pagination } from '@/components/Pagination';
import { InnerPagination } from '@/components/InnerPagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { api } from '@/lib/api';
import { RetryButton } from '@/components/RetryButton';
import type { Artifact, TestStatus, RunResultGroup } from '@/lib/types';
import { cn } from '@/lib/utils';

type FilterStatus = 'all' | TestStatus;
type GroupByMode = 'none' | 'suite';

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 pb-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', valueClass ?? 'text-foreground')}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PassFailBar({ passed, failed, total }: { passed: number; failed: number; total: number }) {
  if (!total) return null;
  const passedPct = (passed / total) * 100;
  const failedPct = (failed / total) * 100;
  const skippedPct = 100 - passedPct - failedPct;

  return (
    <div className="space-y-1">
      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
        <div className="bg-green-500 transition-all" style={{ width: `${passedPct}%` }} title={`Passed: ${passed}`} />
        <div className="bg-red-500 transition-all" style={{ width: `${failedPct}%` }} title={`Failed: ${failed}`} />
        <div className="bg-muted-foreground/30 transition-all" style={{ width: `${skippedPct}%` }} title="Skipped" />
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{passed} passed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{failed} failed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />{total - passed - failed} skipped</span>
      </div>
    </div>
  );
}

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
          onClick={() => onScreenshot(a)}
          className="p-1 rounded text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-muted transition-colors"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      ))}
      {videos.map((a) => (
        <button
          key={a.id}
          title="Play video"
          onClick={() => onVideo(a)}
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
      {artifacts.length === 0 && <span className="text-muted-foreground/60 text-xs">—</span>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 bg-muted rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Results table ─────────────────────────────────────────────────────────────

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
        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
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

// ── Suite group accordion (run detail) ───────────────────────────────────────

function RunSuiteGroup({
  group,
  outerPage,
  teamId,
  onErrorClick,
  onScreenshot,
  onVideo,
}: {
  group: RunResultGroup;
  outerPage: number;
  teamId: string;
  onErrorClick: (err: string) => void;
  onScreenshot: (a: Artifact, title: string) => void;
  onVideo: (a: Artifact, title: string) => void;
}) {
  const [open, setOpen] = useState(group.stats.failed > 0);
  const [innerPage, setInnerPage] = useState(1);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setInnerPage(1);
    setShowAll(false);
  }, [outerPage]);

  const hasInnerPagination = (group.pagination?.totalPages ?? 1) > 1;
  const effectivePageSize = showAll
    ? Math.min(group.pagination?.totalItems ?? 999, 500)
    : (group.pagination?.pageSize ?? 5);

  const displayResults = innerPage === 1 && !showAll
    ? group.results
    : group.results;

  const paginationMeta = group.pagination;

  const { stats } = group;
  const accentClass = cn(
    'w-1 self-stretch rounded-full mr-3 shrink-0',
    stats.failed > 0 ? 'bg-red-500' : stats.total === stats.passed ? 'bg-green-500' : 'bg-muted-foreground/40',
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 cursor-pointer select-none border-b border-border transition-colors',
          stats.failed > 0
            ? 'hover:bg-red-50 dark:hover:bg-red-950/30'
            : 'hover:bg-muted/50',
        )}
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={accentClass} />
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="font-medium text-sm text-foreground truncate">{group.suiteName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-4">
          <span className="text-green-600 dark:text-green-400">{stats.passed}✓</span>
          {stats.failed > 0 && <span className="text-red-600 dark:text-red-400">{stats.failed}✗</span>}
          {stats.skipped > 0 && <span className="text-muted-foreground">{stats.skipped} skipped</span>}
          <span className="text-muted-foreground">{stats.total} total</span>
        </div>
      </div>

      {open && (
        <>
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
              <ResultsTable
                results={displayResults as ResultRow[]}
                teamId={teamId}
                onErrorClick={onErrorClick}
                onScreenshot={onScreenshot}
                onVideo={onVideo}
              />
            </TableBody>
          </Table>

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

// ── Page content ──────────────────────────────────────────────────────────────

function RunDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  const statusParam = (searchParams.get('status') ?? 'all') as FilterStatus;
  const searchParam = searchParams.get('search') ?? '';
  const groupBy = (searchParams.get('groupBy') ?? 'none') as GroupByMode;

  const [searchInput, setSearchInput] = useState(searchParam);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flat view data
  const { data: runDetail, isLoading } = useRun(id, {
    page,
    pageSize,
    status: statusParam !== 'all' ? statusParam : undefined,
    search: searchParam || undefined,
  });

  // Grouped view data
  const { data: groupedData, isLoading: groupedLoading } = useRunResultsGrouped(
    id,
    {
      page,
      pageSize,
      innerPageSize: 5,
      status: statusParam !== 'all' ? statusParam : undefined,
    },
  );

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
  }, [searchInput]);

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Failed', value: 'FAILED' },
    { label: 'Passed', value: 'PASSED' },
    { label: 'Skipped', value: 'SKIPPED' },
    { label: 'Retried', value: 'RETRIED' },
  ];

  if (isLoading && !runDetail) return <LoadingSkeleton />;

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

  return (
    <>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/runs"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Test Runs
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-mono text-foreground/80">{run.id.slice(0, 8)}</span>
          <StatusBadge status={run.status} type="run" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Tests" value={run.totalTests} />
          <SummaryCard label="Passed" value={run.passed} valueClass="text-green-600 dark:text-green-400" />
          <SummaryCard label="Failed" value={run.failed} valueClass="text-red-600 dark:text-red-400" />
          <SummaryCard label="Skipped" value={run.skipped} valueClass="text-muted-foreground" />
          <SummaryCard label="Duration" value={formatDuration(run.duration)} />
        </div>

        {/* Pass/fail bar */}
        {run.totalTests > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <PassFailBar passed={run.passed} failed={run.failed} total={run.totalTests} />
            </CardContent>
          </Card>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            {filterButtons.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => onStatusFilter(value)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  statusParam === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <Input
            placeholder="Search by title…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-52 bg-card border-border text-foreground placeholder:text-muted-foreground h-8 text-sm"
          />

          {/* Group by */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Group by:</span>
            <Select value={groupBy} onValueChange={onGroupByChange}>
              <SelectTrigger className="w-28 bg-card border-border text-foreground h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="none" className="focus:bg-muted">None</SelectItem>
                <SelectItem value="suite" className="focus:bg-muted">Suite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results — grouped by suite */}
        {groupBy === 'suite' ? (
          <div className="space-y-4">
            {isGroupedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 bg-muted rounded-lg" />
                ))}
              </div>
            ) : groupedData ? (
              <>
                <div className="space-y-3">
                  {groupedData.groups.map((group) => (
                    <RunSuiteGroup
                      key={`${group.suiteName}-${page}`}
                      group={group}
                      outerPage={page}
                      teamId={run.teamId}
                      onErrorClick={setErrorModal}
                      onScreenshot={openScreenshot}
                      onVideo={openVideo}
                    />
                  ))}
                  {groupedData.groups.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">No results found</div>
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
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base">
                Results
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  ({resultsPagination.totalItems})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
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

        {/* Run metadata footer */}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
          <span>Started: {formatDate(run.startedAt)}</span>
          {run.finishedAt && <span>Finished: {formatDate(run.finishedAt)}</span>}
          <span className="font-mono">ID: {run.id}</span>
        </div>
      </div>

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

function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 bg-muted rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  return (
    <Suspense fallback={<RunDetailSkeleton />}>
      <RunDetailContent />
    </Suspense>
  );
}
