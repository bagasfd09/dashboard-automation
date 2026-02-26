'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useRuns } from '@/hooks/use-runs';
import { useTeams } from '@/hooks/use-teams';
import { StatusBadge } from '@/components/status-badge';
import { Pagination } from '@/components/Pagination';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { RunsSkeleton } from '@/components/skeletons';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function RunProgressBar({ passed, failed, total }: { passed: number; failed: number; total: number }) {
  if (!total) return null;
  const passedPct = Math.round((passed / total) * 100);
  const failedPct = Math.round((failed / total) * 100);

  return (
    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted w-24 mt-1">
      <div className="bg-green-500 transition-all" style={{ width: `${passedPct}%` }} />
      <div className="bg-red-500 transition-all" style={{ width: `${failedPct}%` }} />
    </div>
  );
}

function RunsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');
  const teamId = searchParams.get('teamId') ?? undefined;

  function setParam(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === undefined || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/runs?${params.toString()}`);
  }

  function onPageChange(p: number) {
    setParam('page', String(p));
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  function onTeamChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('teamId');
    } else {
      params.set('teamId', value);
    }
    params.set('page', '1');
    router.push(`/runs?${params.toString()}`);
  }

  const { data, isLoading, prefetchNext } = useRuns(page, pageSize, teamId);
  const { data: teams } = useTeams();

  const prefetchNextStable = useCallback(prefetchNext, [prefetchNext]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Test Runs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${data.pagination.totalItems} total runs` : 'Loading…'}
        </p>
      </div>

      {/* Team filter */}
      <div className="flex gap-3">
        <Select onValueChange={onTeamChange} value={teamId ?? 'all'}>
          <SelectTrigger className="w-44 bg-card border-border text-foreground">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border text-foreground">
            <SelectItem value="all" className="focus:bg-muted">All teams</SelectItem>
            {teams?.map((team) => (
              <SelectItem key={team.id} value={team.id} className="focus:bg-muted">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">All Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Run ID</TableHead>
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Total</TableHead>
                <TableHead className="text-muted-foreground">Passed</TableHead>
                <TableHead className="text-muted-foreground">Failed</TableHead>
                <TableHead className="text-muted-foreground">Skipped</TableHead>
                <TableHead className="text-muted-foreground">Duration</TableHead>
                <TableHead className="text-muted-foreground">Started At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16 bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.data.map((run) => (
                    <TableRow
                      key={run.id}
                      className="border-border hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/runs/${run.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-foreground/80">
                        {run.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {run.team ? (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                              teamColorClass(run.team.id)
                            )}
                          >
                            {run.team.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <StatusBadge status={run.status as RunStatus} type="run" />
                          {run.status === 'RUNNING' && run.totalTests > 0 && (
                            <RunProgressBar
                              passed={run.passed}
                              failed={run.failed}
                              total={run.totalTests}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground/80 text-sm">{run.totalTests}</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400 text-sm">{run.passed}</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400 text-sm">{run.failed}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{run.skipped}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDuration(run.duration)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(run.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.data.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    <div className="space-y-1">
                      <p className="font-medium">No runs yet</p>
                      <p className="text-xs">Runs will appear here once your tests execute.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

export default function RunsPage() {
  return (
    <Suspense fallback={<RunsSkeleton />}>
      <RunsPageContent />
    </Suspense>
  );
}
