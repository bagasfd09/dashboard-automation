'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  GitBranch,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Plus,
  X,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { MemberTaskSummary, TaskInsight } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TaskProgressSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 bg-muted rounded-xl animate-pulse" />
      <div className="h-20 bg-muted rounded-xl animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-xl p-5 space-y-4 animate-pulse">
          <div className="h-5 bg-muted rounded w-1/4" />
          <div className="h-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Insight Bar ───────────────────────────────────────────────────────────────

function InsightItem({ insight, onDismiss }: { insight: TaskInsight; onDismiss: () => void }) {
  const icons = {
    error: <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
    info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
  };

  return (
    <div className="flex items-start gap-2 text-sm py-1.5">
      {icons[insight.severity]}
      <span className="flex-1">
        {insight.taskGroupId ? (
          <Link href={`/my-tasks/${insight.taskGroupId}`} className="hover:underline">
            {insight.message}
          </Link>
        ) : (
          insight.message
        )}
      </span>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Member Progress Card ──────────────────────────────────────────────────────

function MemberCard({ member }: { member: MemberTaskSummary }) {
  const hasGroups = member.taskGroups.length > 0;
  const lastActivity = member.summary.lastActivity;

  return (
    <div className="border rounded-xl p-5 space-y-4">
      {/* Member header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {member.user.name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-sm">{member.user.name}</p>
            {lastActivity && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last active: {relativeTime(lastActivity)}
              </p>
            )}
          </div>
        </div>
        {member.summary.warning === 'NO_ACTIVE_TASKS' && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            No active tasks
          </Badge>
        )}
      </div>

      {/* Groups */}
      {hasGroups ? (
        <div className="space-y-3">
          {member.taskGroups.map((group) => {
            const localDone = group.progress.localPassed + group.progress.skipped;
            const pct = group.progress.total > 0
              ? Math.round((localDone / group.progress.total) * 100)
              : 0;
            const allPassed = group.progress.total > 0 &&
              group.progress.envPassed + group.progress.skipped === group.progress.total;

            return (
              <Link key={group.id} href={`/my-tasks/${group.id}`} className="block">
                <div
                  className={cn(
                    'border rounded-lg p-3.5 hover:border-primary/30 hover:bg-muted/30 transition-all',
                    group.isOverdue && 'border-red-300 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10',
                    allPassed && 'border-green-300 dark:border-green-900 bg-green-50/30 dark:bg-green-950/10',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {group.branch && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3 w-3" />
                            {group.branch}
                          </span>
                        )}
                        {group.dueDate && (
                          <span className={cn('flex items-center gap-1', group.isOverdue && 'text-red-500 font-medium')}>
                            <Calendar className="h-3 w-3" />
                            {group.isOverdue ? `OVERDUE · ${fmtDate(group.dueDate)}` : `Due ${fmtDate(group.dueDate)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium shrink-0">
                      {pct}%
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-5 mt-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Local:</span>
                      {group.progress.localPassed > 0 && <span className="text-green-600 dark:text-green-400">✅{group.progress.localPassed}</span>}
                      {group.progress.localFailed > 0 && <span className="text-red-500">❌{group.progress.localFailed}</span>}
                      {(group.progress.notStarted + group.progress.inProgress) > 0 && (
                        <span className="text-muted-foreground">⬜{group.progress.notStarted + group.progress.inProgress}</span>
                      )}
                      {group.progress.total === 0 && <span className="text-muted-foreground italic">—</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Staging:</span>
                      {group.progress.envPassed > 0 && <span className="text-green-600 dark:text-green-400">✅{group.progress.envPassed}</span>}
                      {group.progress.envFailed > 0 && <span className="text-red-500">❌{group.progress.envFailed}</span>}
                      {(group.progress.total - group.progress.envPassed - group.progress.envFailed) > 0 && (
                        <span className="text-muted-foreground">
                          ⬜{group.progress.total - group.progress.envPassed - group.progress.envFailed}
                        </span>
                      )}
                      {group.progress.total === 0 && <span className="text-muted-foreground italic">—</span>}
                    </div>
                  </div>

                  <Progress value={pct} className={cn('h-1.5 mt-2', allPassed && 'bg-green-100 dark:bg-green-950')} />

                  {allPassed && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                      ALL PASSING ✅ Release-ready!
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border border-dashed rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">No active task groups</p>
          <Button variant="outline" size="sm" className="mt-2" asChild>
            <Link href={`/my-tasks?assign=${member.user.id}`}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Assign Tasks to {member.user.name.split(' ')[0]}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TaskProgressPage() {
  const [dismissedInsights, setDismissedInsights] = useState<Set<string>>(new Set());

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['task-progress'],
    queryFn: () => api.getTaskProgress(),
    refetchInterval: 30_000,
  });

  const { data: insightsData, isLoading: insightsLoading } = useQuery({
    queryKey: ['task-insights'],
    queryFn: () => api.getTaskInsights(),
    refetchInterval: 60_000,
  });

  const activeInsights = (insightsData?.insights ?? []).filter(
    (_, idx) => !dismissedInsights.has(String(idx)),
  );

  if (progressLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Task Progress</h1>
        <TaskProgressSkeleton />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const { teamSummary } = progress;
  const sprintReady = teamSummary.sprintReadiness === 'READY';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Task Progress
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor your team&apos;s testing implementation progress.
        </p>
      </div>

      {/* Summary bar */}
      <div className="border rounded-xl p-4 bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{teamSummary.totalMembers}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{teamSummary.totalItems}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{teamSummary.localPassRate}%</p>
            <p className="text-xs text-muted-foreground">Local Pass Rate</p>
          </div>
          <div>
            <p className={cn('text-2xl font-bold', teamSummary.envPassRate >= 80 ? 'text-green-600 dark:text-green-400' : 'text-amber-500')}>
              {teamSummary.envPassRate}%
            </p>
            <p className="text-xs text-muted-foreground">Staging Pass Rate</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 items-center text-sm">
          {teamSummary.overdueGroups > 0 && (
            <span className="flex items-center gap-1.5 text-red-500">
              <AlertCircle className="h-4 w-4" />
              {teamSummary.overdueGroups} overdue
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1.5 font-medium',
              sprintReady ? 'text-green-600 dark:text-green-400' : 'text-amber-500',
            )}
          >
            {sprintReady ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            Sprint readiness: {sprintReady ? 'READY ✅' : 'NOT READY'}
          </span>
          <span className="text-muted-foreground text-xs">
            {teamSummary.membersWithoutTasks} member{teamSummary.membersWithoutTasks !== 1 ? 's' : ''} without active tasks
          </span>
        </div>
      </div>

      {/* Insights */}
      {!insightsLoading && activeInsights.length > 0 && (
        <div className="border rounded-xl p-4 bg-card space-y-1">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Smart Insights
          </p>
          {activeInsights.map((insight, idx) => (
            <InsightItem
              key={idx}
              insight={insight}
              onDismiss={() =>
                setDismissedInsights((prev) => new Set(Array.from(prev).concat(String(idx))))
              }
            />
          ))}
        </div>
      )}

      {/* Per-member sections */}
      {progress.members.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-xl">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No team members with task groups found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.members.map((member) => (
            <MemberCard key={member.user.id} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
