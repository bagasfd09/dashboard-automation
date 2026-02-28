import { cn } from '@/lib/utils';

function getEnvConfig(env: string): { className: string } {
  const lower = env.toLowerCase();
  if (lower === 'production' || lower === 'prod') {
    return { className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800' };
  }
  if (lower === 'staging' || lower === 'stage') {
    return { className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800' };
  }
  if (lower === 'local' || lower === 'localhost') {
    return { className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
  }
  if (lower === 'development' || lower === 'dev') {
    return { className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' };
  }
  if (lower === 'sandbox') {
    return { className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-800' };
  }
  return { className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' };
}

interface EnvironmentBadgeProps {
  environment: string | null;
}

export function EnvironmentBadge({ environment }: EnvironmentBadgeProps) {
  if (!environment) return null;

  const { className } = getEnvConfig(environment);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {environment}
    </span>
  );
}
