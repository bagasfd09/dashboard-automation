'use client';

import { useRouter } from 'next/navigation';
import { useOverview, useTeams } from '@/hooks/use-teams';
import { StatusBadge } from '@/components/status-badge';
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="pb-2">
        <Skeleton className="h-3 w-24 bg-zinc-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-16 bg-zinc-800" />
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: overview, isLoading: overviewLoading } = useOverview();
  const { data: teams, isLoading: teamsLoading } = useTeams();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Overview across all teams</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {overviewLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Teams" value={overview?.totalTeams ?? 0} />
            <StatCard label="Test Cases" value={overview?.totalTestCases ?? 0} />
            <StatCard label="Total Runs" value={overview?.totalRuns ?? 0} />
            <StatCard label="Runs Today" value={overview?.todayRuns ?? 0} />
            <StatCard
              label="Pass Rate"
              value={overview ? `${overview.overallPassRate}%` : '—'}
              sub={overview ? `${overview.runsByStatus.failed} failing` : undefined}
            />
          </>
        )}
      </div>

      {/* Run status strip */}
      {overview && (
        <div className="grid grid-cols-4 gap-3">
          {(
            [
              { label: 'Running', count: overview.runsByStatus.running, color: 'text-blue-400' },
              { label: 'Passed', count: overview.runsByStatus.passed, color: 'text-green-400' },
              { label: 'Failed', count: overview.runsByStatus.failed, color: 'text-red-400' },
              { label: 'Cancelled', count: overview.runsByStatus.cancelled, color: 'text-zinc-400' },
            ] as const
          ).map(({ label, count, color }) => (
            <Card key={label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <span className="text-zinc-400 text-xs">{label}</span>
                <span className={cn('text-lg font-bold', color)}>{count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teams summary table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Team</TableHead>
                <TableHead className="text-zinc-400">Test Cases</TableHead>
                <TableHead className="text-zinc-400">Pass Rate</TableHead>
                <TableHead className="text-zinc-400">Last Run</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20 bg-zinc-800" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : teams?.map((team) => (
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
                      <TableCell>
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
                          {team.totalRuns > 0 ? `${team.passRate}%` : '—'}
                        </span>
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
              {!teamsLoading && teams?.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                    No teams yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent activity */}
      {overview && overview.recentActivity.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Test Case</TableHead>
                  <TableHead className="text-zinc-400">Team</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recentActivity.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                    onClick={() => router.push(`/runs/${item.testRunId}`)}
                  >
                    <TableCell className="text-zinc-200 text-sm max-w-xs truncate">
                      {item.testCaseTitle}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
                          teamColorClass(item.teamId)
                        )}
                      >
                        {item.teamName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} type="test" />
                    </TableCell>
                    <TableCell className="text-zinc-400 text-xs">
                      {formatDate(item.startedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
