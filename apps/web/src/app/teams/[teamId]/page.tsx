'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTeamStats } from '@/hooks/use-teams';
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
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/lib/types';

function formatDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function SummaryCard({ label, value, sub, valueClass }: {
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-4 pb-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', valueClass ?? 'text-foreground')}>{value}</p>
        {sub && <p className="text-muted-foreground text-xs mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48 bg-muted" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const { data: stats, isLoading } = useTeamStats(teamId);

  if (isLoading) return <LoadingSkeleton />;

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p className="text-lg font-medium">Team not found</p>
        <Link href="/teams" className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          Back to teams
        </Link>
      </div>
    );
  }

  const { team, testCases, runs, topFailingTests, recentRuns } = stats;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/teams"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Teams
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium',
            teamColorClass(team.id)
          )}
        >
          {team.name}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Test Cases" value={testCases.total} />
        <SummaryCard
          label="Total Runs"
          value={runs.total}
          sub={`${runs.thisWeek} this week`}
        />
        <SummaryCard
          label="Pass Rate"
          value={runs.total > 0 ? `${runs.passRate}%` : '—'}
          valueClass={
            runs.passRate >= 80
              ? 'text-green-600 dark:text-green-400'
              : runs.passRate >= 50
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
          }
        />
        <SummaryCard
          label="Avg Duration"
          value={formatDuration(runs.avgDuration)}
        />
      </div>

      {/* Test case health */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">With Failures</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{testCases.withFailures}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Never Run</span>
            <span className="text-lg font-bold text-muted-foreground">{testCases.withoutRuns}</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Healthy</span>
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {testCases.total - testCases.withFailures - testCases.withoutRuns}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Top failing tests */}
      {topFailingTests.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Top Failing Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Test Case</TableHead>
                  <TableHead className="text-muted-foreground text-right">Failures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topFailingTests.map((test) => (
                  <TableRow key={test.id} className="border-border hover:bg-muted/40">
                    <TableCell className="text-foreground/90 text-sm">{test.title}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 dark:text-red-400 font-medium text-sm">{test.failureCount}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent runs */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground text-base">Recent Runs</CardTitle>
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
              onClick={() => router.push(`/runs?teamId=${team.id}`)}
            >
              View all →
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Run ID</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Passed</TableHead>
                <TableHead className="text-muted-foreground">Failed</TableHead>
                <TableHead className="text-muted-foreground">Duration</TableHead>
                <TableHead className="text-muted-foreground">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRuns.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No runs yet
                  </TableCell>
                </TableRow>
              ) : (
                recentRuns.map((run) => (
                  <TableRow
                    key={run.id}
                    className="border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/runs/${run.id}`)}
                  >
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {run.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status as RunStatus} type="run" />
                    </TableCell>
                    <TableCell className="text-green-600 dark:text-green-400 text-sm">{run.passed}</TableCell>
                    <TableCell className="text-red-600 dark:text-red-400 text-sm">{run.failed}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDuration(run.duration)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(run.startedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="flex gap-3 text-sm">
        <Link
          href={`/test-cases?teamId=${team.id}`}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
        >
          → View all test cases for this team
        </Link>
        <span className="text-muted-foreground/40">·</span>
        <Link
          href={`/runs?teamId=${team.id}`}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors"
        >
          → View all runs for this team
        </Link>
      </div>
    </div>
  );
}
