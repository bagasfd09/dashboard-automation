import { cn } from '@/lib/utils';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus, SuggestionType } from '@/lib/types';

export function PriorityBadge({ priority, className }: { priority: TestPriority; className?: string }) {
  const colors: Record<TestPriority, string> = {
    P0: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border border-red-200 dark:border-red-800',
    P1: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border border-orange-200 dark:border-orange-800',
    P2: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
    P3: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border border-green-200 dark:border-green-800',
  };
  const labels: Record<TestPriority, string> = { P0: 'P0 Critical', P1: 'P1 High', P2: 'P2 Medium', P3: 'P3 Low' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', colors[priority], className)}>
      {labels[priority]}
    </span>
  );
}

export function DifficultyBadge({ difficulty, className }: { difficulty: TestDifficulty; className?: string }) {
  const colors: Record<TestDifficulty, string> = {
    EASY: 'text-blue-600 dark:text-blue-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
    HARD: 'text-orange-600 dark:text-orange-400',
    COMPLEX: 'text-red-600 dark:text-red-400',
  };
  return (
    <span className={cn('text-xs font-medium', colors[difficulty], className)}>
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  );
}

export function LibraryStatusBadge({ status, className }: { status: LibraryTestCaseStatus; className?: string }) {
  const styles: Record<LibraryTestCaseStatus, string> = {
    DRAFT: 'bg-muted text-muted-foreground',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    DEPRECATED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
    ARCHIVED: 'bg-muted text-muted-foreground/60',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[status], className)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function SuggestionTypeBadge({ type, className }: { type: SuggestionType; className?: string }) {
  const styles: Record<SuggestionType, string> = {
    IMPROVEMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    BUG_REPORT: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    UPDATE: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    OBSOLETE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  const labels: Record<SuggestionType, string> = {
    IMPROVEMENT: 'Improvement',
    BUG_REPORT: 'Bug Report',
    UPDATE: 'Update',
    OBSOLETE: 'Obsolete',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', styles[type], className)}>
      {labels[type]}
    </span>
  );
}

export function CoverageBar({
  value,
  className,
}: {
  value: number; // 0-100
  className?: string;
}) {
  const color =
    value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className={cn('h-1.5 rounded-full bg-muted overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
