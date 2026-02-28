'use client';

import { useRouter } from 'next/navigation';
import { useOverview, useTeams } from '@/hooks/use-teams';
import { useAppContext } from '@/providers/AppContextProvider';
import { StatusBadge } from '@/components/status-badge';
import { EnvironmentBadge } from '@/components/ui/environment-badge';
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
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <Skeleton className="h-3 w-24 bg-muted" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-16 bg-muted" />
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
  const { selectedApp, selectedEnv } = useAppContext();
  const { data: overview, isLoading: overviewLoading } = useOverview(selectedApp?.id);
  const { data: teams, isLoading: teamsLoading } = useTeams();

  // Determine zoom level label
  const zoomLabel = selectedApp
    ? selectedEnv
      ? `${selectedApp.name} · ${selectedEnv}`
      : selectedApp.name
    : 'Portfolio';

  const subLabel = selectedApp
    ? selectedEnv
      ? `Focused view — ${selectedApp.name} in ${selectedEnv}`
      : `Application view — all environments`
    : 'Overview across all teams and applications';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard · {zoomLabel}</h1>
          <p className="text-muted-foreground text-sm mt-1">{subLabel}</p>
        </div>
        {selectedApp && (
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: selectedApp.color ?? '#6b7280' }}
            >
              {selectedApp.icon || selectedApp.name.charAt(0)}
            </div>
            {selectedEnv && <EnvironmentBadge environment={selectedEnv} />}
          </div>
        )}
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
              { label: 'Running', count: overview.runsByStatus.running, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Passed', count: overview.runsByStatus.passed, color: 'text-green-600 dark:text-green-400' },
              { label: 'Failed', count: overview.runsByStatus.failed, color: 'text-red-600 dark:text-red-400' },
              { label: 'Cancelled', count: overview.runsByStatus.cancelled, color: 'text-muted-foreground' },
            ] as const
          ).map(({ label, count, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className={cn('text-lg font-bold', color)}>{count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teams summary table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Team</TableHead>
                <TableHead className="text-muted-foreground">Test Cases</TableHead>
                <TableHead className="text-muted-foreground">Pass Rate</TableHead>
                <TableHead className="text-muted-foreground">Last Run</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20 bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : teams?.map((team) => (
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
                      <TableCell>
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
                          {team.totalRuns > 0 ? `${team.passRate}%` : '—'}
                        </span>
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
              {!teamsLoading && teams?.length === 0 && (
                <TableRow className="border-border">
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Test Case</TableHead>
                  <TableHead className="text-muted-foreground">Team</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.recentActivity.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/runs/${item.testRunId}`)}
                  >
                    <TableCell className="text-foreground/90 text-sm max-w-xs truncate">
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
                    <TableCell className="text-muted-foreground text-xs">
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
