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
    <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-700 w-24 mt-1">
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
        <h1 className="text-2xl font-bold text-white">Test Runs</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {data ? `${data.pagination.totalItems} total runs` : 'Loading…'}
        </p>
      </div>

      {/* Team filter */}
      <div className="flex gap-3">
        <Select onValueChange={onTeamChange} value={teamId ?? 'all'}>
          <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectValue placeholder="All teams" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectItem value="all" className="focus:bg-zinc-800">All teams</SelectItem>
            {teams?.map((team) => (
              <SelectItem key={team.id} value={team.id} className="focus:bg-zinc-800">
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">All Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Run ID</TableHead>
                <TableHead className="text-zinc-400">Team</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Total</TableHead>
                <TableHead className="text-zinc-400">Passed</TableHead>
                <TableHead className="text-zinc-400">Failed</TableHead>
                <TableHead className="text-zinc-400">Skipped</TableHead>
                <TableHead className="text-zinc-400">Duration</TableHead>
                <TableHead className="text-zinc-400">Started At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16 bg-zinc-800" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data?.data.map((run) => (
                    <TableRow
                      key={run.id}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => router.push(`/runs/${run.id}`)}
                    >
                      <TableCell className="font-mono text-xs text-zinc-300">
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
                          <span className="text-zinc-600 text-xs">—</span>
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
                      <TableCell className="text-zinc-300 text-sm">{run.totalTests}</TableCell>
                      <TableCell className="text-green-400 text-sm">{run.passed}</TableCell>
                      <TableCell className="text-red-400 text-sm">{run.failed}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{run.skipped}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">
                        {formatDuration(run.duration)}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {formatDate(run.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && data?.data.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={9} className="text-center text-zinc-500 py-12">
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

function RunsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32 bg-zinc-800" />
      <Skeleton className="h-10 w-44 bg-zinc-800" />
      <Skeleton className="h-64 bg-zinc-800 rounded-lg" />
    </div>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<RunsPageSkeleton />}>
      <RunsPageContent />
    </Suspense>
  );
}
