import { cn } from '@/lib/utils';
import type { RunStatus, TestStatus } from '@/lib/types';

const RUN_COLORS: Record<RunStatus, string> = {
  RUNNING:   'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30',
  PASSED:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  FAILED:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30',
};

const TEST_COLORS: Record<TestStatus, string> = {
  PASSED:  'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30',
  FAILED:  'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
  SKIPPED: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/20 dark:text-zinc-400 dark:border-zinc-500/30',
  RETRIED: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
};

interface StatusBadgeProps {
  status: RunStatus | TestStatus;
  type?: 'run' | 'test';
}

export function StatusBadge({ status, type = 'run' }: StatusBadgeProps) {
  const colors =
    type === 'run'
      ? RUN_COLORS[status as RunStatus]
      : TEST_COLORS[status as TestStatus];

  const isRunning = type === 'run' && status === 'RUNNING';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium',
        colors
      )}
    >
      {isRunning && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {status}
    </span>
  );
}
