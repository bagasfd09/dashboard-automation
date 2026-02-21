import { cn } from '@/lib/utils';
import type { RunStatus, TestStatus } from '@/lib/types';

const RUN_COLORS: Record<RunStatus, string> = {
  RUNNING:   'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PASSED:    'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED:    'bg-red-500/20 text-red-400 border-red-500/30',
  CANCELLED: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const TEST_COLORS: Record<TestStatus, string> = {
  PASSED:  'bg-green-500/20 text-green-400 border-green-500/30',
  FAILED:  'bg-red-500/20 text-red-400 border-red-500/30',
  SKIPPED: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  RETRIED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
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
