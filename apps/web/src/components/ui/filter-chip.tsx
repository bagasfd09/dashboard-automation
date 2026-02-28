import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  icon?: string;
  className?: string;
}

export function FilterChip({ label, active, onClick, count, icon, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-[5px] rounded-lg border text-[12px] font-medium transition-all duration-150 select-none',
        active
          ? 'bg-primary/10 text-primary border-primary/40 dark:bg-primary/20 dark:text-primary dark:border-primary/40'
          : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-border/80 hover:bg-muted/40',
        className,
      )}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            'inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold min-w-[18px]',
            active
              ? 'bg-primary/20 text-primary dark:bg-primary/30'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
