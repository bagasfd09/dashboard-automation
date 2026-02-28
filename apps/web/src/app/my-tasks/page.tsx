'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Calendar,
  GitBranch,
  ChevronRight,
  AlertCircle,
  MoreHorizontal,
  Archive,
  CheckCircle2,
  Trash2,
  Edit,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TaskGroup, TaskGroupStatus } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getUpcomingFriday(weeksAhead = 0): string {
  const now = new Date();
  const day = now.getDay();
  let daysUntil = (5 - day + 7) % 7;
  if (daysUntil === 0) daysUntil = 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil + weeksAhead * 7);
  return target.toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueDateDisplay(dueDate: string | null, isOverdue: boolean) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const today = new Date();
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);

  if (isOverdue) {
    return { label: `Overdue (${fmtDate(dueDate)})`, cls: 'text-red-600 dark:text-red-400', icon: true };
  }
  if (diffDays === 0) {
    return { label: 'Due today', cls: 'text-amber-600 dark:text-amber-400', icon: true };
  }
  if (diffDays === 1) {
    return { label: 'Due tomorrow', cls: 'text-amber-500 dark:text-amber-400', icon: false };
  }
  return { label: `Due ${fmtDate(dueDate)}`, cls: 'text-muted-foreground', icon: false };
}

function calcProgressPct(progress: TaskGroup['progress']) {
  if (progress.total === 0) return 0;
  const done = progress.localPassed + progress.skipped;
  return Math.round((done / progress.total) * 100);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MyTasksSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3 animate-pulse">
          <div className="h-5 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-2 bg-muted rounded w-full" />
          <div className="flex gap-4">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Create Task Group Modal ───────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

function CreateTaskGroupModal({ open, onOpenChange, onCreated }: CreateModalProps) {
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [dueDate, setDueDate] = useState(getUpcomingFriday(0));
  const [customDate, setCustomDate] = useState('');
  const [dueDateMode, setDueDateMode] = useState<'this-fri' | 'next-fri' | 'custom' | 'none'>('this-fri');

  const queryClient = useQueryClient();

  const resolvedDueDate =
    dueDateMode === 'this-fri'
      ? getUpcomingFriday(0)
      : dueDateMode === 'next-fri'
        ? getUpcomingFriday(1)
        : dueDateMode === 'custom'
          ? customDate
          : undefined;

  const createMutation = useMutation({
    mutationFn: () =>
      api.createTaskGroup({
        name: name.trim(),
        branch: branch.trim() || undefined,
        dueDate: resolvedDueDate || undefined,
      }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      toast.success(`Task group created: ${name.trim()}`);
      setName('');
      setBranch('');
      onOpenChange(false);
      onCreated(group.id);
    },
    onError: () => {
      toast.error('Failed to create task group');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tg-name">Group Name *</Label>
            <Input
              id="tg-name"
              autoFocus
              placeholder="Sprint 14 — Payment Tests"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim().length >= 2) createMutation.mutate();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tg-branch">Branch (optional)</Label>
            <Input
              id="tg-branch"
              placeholder="feature/payment-new-methods"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              SDK test runs from this branch will auto-update task progress
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Due Date</Label>
            <div className="flex gap-2 flex-wrap">
              {(['this-fri', 'next-fri', 'none'] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  size="sm"
                  variant={dueDateMode === mode ? 'default' : 'outline'}
                  onClick={() => setDueDateMode(mode)}
                >
                  {mode === 'this-fri' ? 'This Fri' : mode === 'next-fri' ? 'Next Fri' : 'None'}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={dueDateMode === 'custom' ? 'default' : 'outline'}
                onClick={() => setDueDateMode('custom')}
              >
                Custom
              </Button>
            </div>
            {dueDateMode === 'custom' && (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-2"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SmartButton
            onClick={async () => { await createMutation.mutateAsync(); }}
            disabled={name.trim().length < 2}
            loading={createMutation.isPending}
          >
            Create Task Group
          </SmartButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Group Card ───────────────────────────────────────────────────────────

interface CardProps {
  group: TaskGroup;
  onDelete: () => void;
  onArchive: () => void;
  onComplete: () => void;
}

function TaskGroupCard({ group, onDelete, onArchive, onComplete }: CardProps) {
  const due = dueDateDisplay(group.dueDate, group.isOverdue);
  const pct = calcProgressPct(group.progress);
  const selfAssigned = group.createdById === group.userId;

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30',
        group.isOverdue && 'border-red-300 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/my-tasks/${group.id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="font-semibold text-base hover:text-primary transition-colors truncate">
            {group.name}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {group.branch && (
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {group.branch}
              </span>
            )}
            {group.application && (
              <span className="flex items-center gap-1">
                {group.application.icon} {group.application.name}
              </span>
            )}
            {due && (
              <span className={cn('flex items-center gap-1', due.cls)}>
                {due.icon && <AlertCircle className="h-3 w-3" />}
                <Calendar className="h-3 w-3" />
                {due.label}
              </span>
            )}
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/my-tasks/${group.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                View / Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark Complete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress */}
      <Link href={`/my-tasks/${group.id}`} className="block mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progress</span>
          <span className="font-medium">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />

        {/* Dual stats */}
        <div className="flex gap-6 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">My Branch:</span>
            {group.progress.localPassed > 0 && (
              <span className="text-green-600 dark:text-green-400">✅ {group.progress.localPassed}</span>
            )}
            {group.progress.localFailed > 0 && (
              <span className="text-red-500">❌ {group.progress.localFailed}</span>
            )}
            {group.progress.notStarted + group.progress.inProgress > 0 && (
              <span className="text-muted-foreground">
                ⬜ {group.progress.notStarted + group.progress.inProgress}
              </span>
            )}
            {group.progress.total === 0 && <span className="text-muted-foreground italic">no items</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Staging:</span>
            {group.progress.envPassed > 0 && (
              <span className="text-green-600 dark:text-green-400">✅ {group.progress.envPassed}</span>
            )}
            {group.progress.envFailed > 0 && (
              <span className="text-red-500">❌ {group.progress.envFailed}</span>
            )}
            {group.progress.total - group.progress.envPassed - group.progress.envFailed > 0 && (
              <span className="text-muted-foreground">
                ⬜ {group.progress.total - group.progress.envPassed - group.progress.envFailed}
              </span>
            )}
            {group.progress.total === 0 && <span className="text-muted-foreground italic">—</span>}
          </div>
        </div>

        {!selfAssigned && (
          <p className="text-xs text-muted-foreground mt-2">
            Assigned by {group.createdBy.name}
          </p>
        )}
      </Link>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<TaskGroupStatus>('ACTIVE');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TaskGroup | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['task-groups', 'mine', statusFilter],
    queryFn: () => api.listTaskGroups({ status: statusFilter }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskGroupStatus }) =>
      api.updateTaskGroup(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTaskGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      toast.success('Task group deleted');
      setDeleteTarget(null);
    },
  });

  // Sort overdue groups first
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return 0;
    });
  }, [groups]);

  const statusTabs: { value: TaskGroupStatus; label: string }[] = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            My Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your personal testing work board.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Task Group
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {statusTabs.map((tab) => {
          const count = tab.value === statusFilter ? sortedGroups.length : undefined;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-background shadow text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span className="ml-1.5 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <MyTasksSkeleton />
      ) : sortedGroups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">
            {statusFilter === 'ACTIVE' ? 'No active task groups yet' : `No ${statusFilter.toLowerCase()} task groups`}
          </h3>
          {statusFilter === 'ACTIVE' && (
            <>
              <p className="text-muted-foreground text-sm mt-1 mb-4">
                Create one to start tracking your testing work,
                <br />
                or ask your Team Lead to assign tasks.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task Group
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/library">Browse Library →</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedGroups.map((group) => (
            <TaskGroupCard
              key={group.id}
              group={group}
              onDelete={() => setDeleteTarget(group)}
              onArchive={() => {
                updateMutation.mutate({ id: group.id, status: 'ARCHIVED' });
                toast.success(`Archived: ${group.name}`);
              }}
              onComplete={() => {
                updateMutation.mutate({ id: group.id, status: 'COMPLETED' });
                toast.success(`Marked complete: ${group.name}`);
              }}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateTaskGroupModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/my-tasks/${id}`)}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Task Group"
          description={`Delete "${deleteTarget.name}" and all its items? This cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={async () => { await deleteMutation.mutateAsync(deleteTarget.id); }}
        />
      )}
    </div>
  );
}
