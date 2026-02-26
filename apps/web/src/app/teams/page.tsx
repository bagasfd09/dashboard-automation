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
import { TeamsSkeleton } from '@/components/skeletons';
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
        <h1 className="text-2xl font-bold text-foreground">Teams</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {teams ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : 'Loading…'}
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">All Teams</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">Test Cases</TableHead>
                <TableHead className="text-muted-foreground">Total Runs</TableHead>
                <TableHead className="text-muted-foreground">Pass Rate</TableHead>
                <TableHead className="text-muted-foreground">Last Run</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20 bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : pagedTeams.map((team) => (
                    <TableRow
                      key={team.id}
                      className="border-border hover:bg-muted/50 cursor-pointer"
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
                      <TableCell className="text-foreground/80 text-sm">{team.totalTestCases}</TableCell>
                      <TableCell className="text-foreground/80 text-sm">{team.totalRuns}</TableCell>
                      <TableCell>
                        {team.totalRuns > 0 ? (
                          <span
                            className={cn(
                              'text-sm font-medium',
                              team.passRate >= 80
                                ? 'text-green-600 dark:text-green-400'
                                : team.passRate >= 50
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-red-600 dark:text-red-400'
                            )}
                          >
                            {team.passRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDate(team.lastRunAt)}
                      </TableCell>
                      <TableCell>
                        {team.lastRunStatus ? (
                          <StatusBadge status={team.lastRunStatus as RunStatus} type="run" />
                        ) : (
                          <span className="text-muted-foreground/60 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && pagedTeams.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
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

export default function TeamsPage() {
  return (
    <Suspense fallback={<TeamsSkeleton />}>
      <TeamsPageContent />
    </Suspense>
  );
}
