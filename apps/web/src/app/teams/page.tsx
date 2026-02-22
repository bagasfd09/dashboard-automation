'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/lib/types';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function TeamsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '20');

  const { data: teams, isLoading } = useTeams();

  // Client-side slice for pagination
  const totalItems = teams?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedTeams = teams?.slice((page - 1) * pageSize, page * pageSize) ?? [];

  function onPageChange(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/teams?${params.toString()}`);
  }

  function onPageSizeChange(ps: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', String(ps));
    params.set('page', '1');
    router.push(`/teams?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Teams</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {teams ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : 'Loading…'}
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">All Teams</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Team</TableHead>
                <TableHead className="text-zinc-400">Test Cases</TableHead>
                <TableHead className="text-zinc-400">Total Runs</TableHead>
                <TableHead className="text-zinc-400">Pass Rate</TableHead>
                <TableHead className="text-zinc-400">Last Run</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20 bg-zinc-800" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : pagedTeams.map((team) => (
                    <TableRow
                      key={team.id}
                      className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                      onClick={() => router.push(`/teams/${team.id}`)}
                    >
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                            teamColorClass(team.id)
                          )}
                        >
                          {team.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-zinc-300 text-sm">{team.totalTestCases}</TableCell>
                      <TableCell className="text-zinc-300 text-sm">{team.totalRuns}</TableCell>
                      <TableCell>
                        {team.totalRuns > 0 ? (
                          <span
                            className={cn(
                              'text-sm font-medium',
                              team.passRate >= 80
                                ? 'text-green-400'
                                : team.passRate >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                            )}
                          >
                            {team.passRate}%
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-400 text-xs">
                        {formatDate(team.lastRunAt)}
                      </TableCell>
                      <TableCell>
                        {team.lastRunStatus ? (
                          <StatusBadge status={team.lastRunStatus as RunStatus} type="run" />
                        ) : (
                          <span className="text-zinc-600 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && pagedTeams.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={6} className="text-center text-zinc-500 py-12">
                    <p className="font-medium">No teams yet</p>
                    <p className="text-xs mt-1">Teams are created when the reporter runs for the first time.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalItems > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}

function TeamsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24 bg-zinc-800" />
      <Skeleton className="h-64 bg-zinc-800 rounded-lg" />
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<TeamsPageSkeleton />}>
      <TeamsPageContent />
    </Suspense>
  );
}
