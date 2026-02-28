import { Monitor, Cog, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunSource } from '@/lib/types';

const SOURCE_CONFIG: Record<RunSource, {
  label: string;
  icon: React.ElementType;
  className: string;
}> = {
  LOCAL: {
    label: 'Local',
    icon: Monitor,
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  CI: {
    label: 'CI',
    icon: Cog,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  },
  MANUAL: {
    label: 'Manual',
    icon: RefreshCw,
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  },
};

interface RunSourceBadgeProps {
  source: RunSource;
  size?: 'sm' | 'md';
}

export function RunSourceBadge({ source, size = 'sm' }: RunSourceBadgeProps) {
  const config = SOURCE_CONFIG[source];
  if (!config) return null;

  const Icon = config.icon;
  const isSmall = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        isSmall ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
        config.className,
      )}
    >
      <Icon className={isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {config.label}
    </span>
  );
}
