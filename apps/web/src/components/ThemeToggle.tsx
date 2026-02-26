'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const CYCLE: Record<string, string> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICONS: Record<string, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-md text-sm', className)}>
        <div className="w-4 h-4" />
      </div>
    );
  }

  const current = theme ?? 'light';
  const Icon = ICONS[current] ?? Sun;
  const label = LABELS[current] ?? 'Light';

  function cycle() {
    setTheme(CYCLE[current] ?? 'light');
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} — click to switch`}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
        'text-sidebar-foreground hover:text-sidebar-active-text hover:bg-sidebar-hover',
        className,
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
