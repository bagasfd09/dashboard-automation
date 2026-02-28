import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchBadgeProps {
  branch: string | null;
  maxLength?: number;
}

export function BranchBadge({ branch, maxLength = 30 }: BranchBadgeProps) {
  if (!branch) return null;

  const truncated = branch.length > maxLength ? branch.slice(0, maxLength) + '…' : branch;

  return (
    <span
      title={branch.length > maxLength ? branch : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-mono px-1.5 py-0.5 text-xs',
        'bg-blue-50 text-blue-700 border-blue-200',
        'dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
      )}
    >
      <GitBranch className="h-3 w-3 shrink-0" />
      <span className="truncate">{truncated}</span>
    </span>
  );
}
