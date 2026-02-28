import { cn } from '@/lib/utils';

type HistoryStatus = 'passed' | 'failed' | 'skipped';

interface HistoryDotsProps {
  history: HistoryStatus[];
  maxVisible?: number;
}

const COLOR: Record<HistoryStatus, string> = {
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  skipped: 'bg-yellow-500',
};

export function HistoryDots({ history, maxVisible = 8 }: HistoryDotsProps) {
  const visible = history.slice(-maxVisible);

  if (!visible.length) return null;

  return (
    <div className="flex items-center gap-[3px]">
      {visible.map((status, i) => {
        // Older = lower opacity, newer = full opacity
        const opacity = 0.4 + (i / (visible.length - 1 || 1)) * 0.5;
        return (
          <div
            key={i}
            className={cn('rounded-[2px] shrink-0', COLOR[status])}
            style={{ width: 6, height: 14, opacity }}
            title={`${status.charAt(0).toUpperCase() + status.slice(1)}`}
          />
        );
      })}
    </div>
  );
}
