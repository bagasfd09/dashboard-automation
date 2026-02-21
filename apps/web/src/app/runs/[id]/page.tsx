'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Camera,
  Video,
  FileText,
  Download,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from 'lucide-react';
import { useRun } from '@/hooks/use-runs';
import { StatusBadge } from '@/components/status-badge';
import { ScreenshotViewer } from '@/components/ScreenshotViewer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Artifact, TestStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortKey = 'status' | 'duration' | 'title';
type FilterStatus = 'all' | TestStatus;

const STATUS_ORDER: Record<TestStatus, number> = {
  FAILED: 0,
  RETRIED: 1,
  PASSED: 2,
  SKIPPED: 3,
};

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

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
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-4 pb-4">
        <p className="text-zinc-400 text-xs uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', valueClass ?? 'text-white')}>{value}</p>
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
      <div className="flex h-3 rounded-full overflow-hidden bg-zinc-700">
        <div className="bg-green-500 transition-all" style={{ width: `${passedPct}%` }} title={`Passed: ${passed}`} />
        <div className="bg-red-500 transition-all" style={{ width: `${failedPct}%` }} title={`Failed: ${failed}`} />
        <div className="bg-zinc-600 transition-all" style={{ width: `${skippedPct}%` }} title="Skipped" />
      </div>
      <div className="flex gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{passed} passed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{failed} failed</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />{total - passed - failed} skipped</span>
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
          className="p-1 rounded text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 transition-colors"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      ))}
      {videos.map((a) => (
        <button
          key={a.id}
          title="Play video"
          onClick={() => onVideo(a)}
          className="p-1 rounded text-zinc-400 hover:text-purple-400 hover:bg-zinc-700 transition-colors"
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
          className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-zinc-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {a.type === 'TRACE' ? (
            <FileText className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
        </a>
      ))}
      {artifacts.length === 0 && <span className="text-zinc-600 text-xs">—</span>}
    </div>
  );
}

function ErrorCell({ error }: { error?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!error) return <span className="text-zinc-600 text-xs">—</span>;

  const firstLine = error.split('\n')[0] ?? error;
  const truncated = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;

  return (
    <button
      className="text-left text-xs text-red-400 hover:text-red-300 transition-colors max-w-[200px] truncate"
      title="Click to expand"
      onClick={() => setExpanded(true)}
    >
      {truncated}
      {expanded && (
        <span onClick={(e) => e.stopPropagation()}>
          {/* handled by modal below */}
        </span>
      )}
    </button>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onSort: (k: SortKey) => void;
}) {
  return (
    <button
      className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors text-sm font-medium"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {current === sortKey ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 bg-zinc-800" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-zinc-800 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-4 bg-zinc-800 rounded-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-zinc-800 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: run, isLoading } = useRun(id);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('status');
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Screenshot viewer state
  const [screenshotState, setScreenshotState] = useState<{
    screenshots: { url: string; title: string }[];
    index: number;
  } | null>(null);

  // Video player state
  const [videoState, setVideoState] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // Collect all screenshots across the run for navigation
  const allScreenshots = useMemo(() => {
    if (!run?.results) return [] as { url: string; title: string; artifactId: string }[];
    return run.results.flatMap((r) =>
      r.artifacts
        .filter((a) => a.type === 'SCREENSHOT')
        .map((a) => ({
          url: api.artifactProxyUrl(a.id),
          title: r.testCase?.title ?? 'Screenshot',
          artifactId: a.id,
        }))
    );
  }, [run?.results]);

  const filteredResults = useMemo(() => {
    if (!run?.results) return [];
    const filtered =
      statusFilter === 'all'
        ? run.results
        : run.results.filter((r) => r.status === statusFilter);

    return [...filtered].sort((a, b) => {
      if (sortBy === 'title')
        return (a.testCase?.title ?? '').localeCompare(b.testCase?.title ?? '');
      if (sortBy === 'duration') return (b.duration ?? 0) - (a.duration ?? 0);
      return (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    });
  }, [run?.results, statusFilter, sortBy]);

  function openScreenshot(artifact: Artifact, resultTitle: string) {
    const idx = allScreenshots.findIndex((s) => s.artifactId === artifact.id);
    setScreenshotState({
      screenshots: allScreenshots,
      index: idx >= 0 ? idx : 0,
    });
    void resultTitle;
  }

  function openVideo(artifact: Artifact, resultTitle: string) {
    setVideoState({
      url: api.artifactProxyUrl(artifact.id),
      title: resultTitle,
    });
  }

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Failed', value: 'FAILED' },
    { label: 'Passed', value: 'PASSED' },
    { label: 'Skipped', value: 'SKIPPED' },
  ];

  if (isLoading) return <LoadingSkeleton />;

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
        <p className="text-lg font-medium">Run not found</p>
        <Link href="/runs" className="mt-2 text-sm text-blue-400 hover:underline">
          Back to runs
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/runs"
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Test Runs
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="font-mono text-zinc-300">{run.id.slice(0, 8)}</span>
          <StatusBadge status={run.status} type="run" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <SummaryCard label="Total Tests" value={run.totalTests} />
          <SummaryCard label="Passed" value={run.passed} valueClass="text-green-400" />
          <SummaryCard label="Failed" value={run.failed} valueClass="text-red-400" />
          <SummaryCard label="Skipped" value={run.skipped} valueClass="text-zinc-400" />
          <SummaryCard label="Duration" value={formatDuration(run.duration)} />
        </div>

        {/* Pass/fail bar */}
        {run.totalTests > 0 && (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="pt-4 pb-4">
              <PassFailBar passed={run.passed} failed={run.failed} total={run.totalTests} />
            </CardContent>
          </Card>
        )}

        {/* Results table */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-white text-base">
                Results
                <span className="ml-2 text-zinc-500 font-normal text-sm">
                  ({filteredResults.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {filterButtons.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setStatusFilter(value)}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium transition-colors',
                      statusFilter === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead>
                    <SortHeader label="Test Case" sortKey="title" current={sortBy} onSort={setSortBy} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Status" sortKey="status" current={sortBy} onSort={setSortBy} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Duration" sortKey="duration" current={sortBy} onSort={setSortBy} />
                  </TableHead>
                  <TableHead className="text-zinc-400">Retries</TableHead>
                  <TableHead className="text-zinc-400">Artifacts</TableHead>
                  <TableHead className="text-zinc-400">Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.length === 0 ? (
                  <TableRow className="border-zinc-800">
                    <TableCell colSpan={6} className="text-center text-zinc-500 py-10">
                      No results match the current filter
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((result) => {
                    const title = result.testCase?.title ?? result.testCaseId;
                    return (
                      <TableRow key={result.id} className="border-zinc-800 hover:bg-zinc-800/40">
                        <TableCell className="text-zinc-200 text-sm max-w-xs">
                          <div className="truncate" title={title}>{title}</div>
                          {result.testCase?.filePath && (
                            <div className="text-zinc-500 text-xs mt-0.5 truncate">
                              {result.testCase.filePath}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={result.status} type="test" />
                        </TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {formatDuration(result.duration)}
                        </TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {result.retryCount > 0 ? (
                            <span className="text-yellow-400">{result.retryCount}</span>
                          ) : (
                            '0'
                          )}
                        </TableCell>
                        <TableCell>
                          <ArtifactButtons
                            artifacts={result.artifacts ?? []}
                            onScreenshot={(a) => openScreenshot(a, title)}
                            onVideo={(a) => openVideo(a, title)}
                          />
                        </TableCell>
                        <TableCell>
                          {result.error ? (
                            <button
                              className="text-left text-xs text-red-400 hover:text-red-300 transition-colors max-w-[180px] block"
                              onClick={() => setErrorModal(result.error!)}
                            >
                              <span className="truncate block">
                                {(result.error.split('\n')[0] ?? result.error).slice(0, 60)}
                                {result.error.length > 60 ? '…' : ''}
                              </span>
                            </button>
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Run metadata footer */}
        <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
          <span>Started: {formatDate(run.startedAt)}</span>
          {run.finishedAt && <span>Finished: {formatDate(run.finishedAt)}</span>}
          <span className="font-mono">ID: {run.id}</span>
        </div>
      </div>

      {/* Error modal */}
      <Dialog open={!!errorModal} onOpenChange={() => setErrorModal(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="text-white">Error Details</DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-auto rounded-md bg-zinc-950 border border-zinc-800 p-4">
            <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
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
