'use client';

/**
 * KeyboardHint — Visual keyboard shortcut badge (auto-detects Mac vs Windows).
 *
 * Usage:
 *   <KeyboardHint combo="mod+k" />       → ⌘K  /  Ctrl K
 *   <KeyboardHint combo="escape" />      → Esc
 *   <KeyboardHint combo="mod+enter" />   → ⌘↵  /  Ctrl ↵
 *   <KeyboardHint keys={['⌘', 'K']} />  → ⌘K  (explicit)
 */

import { cn } from '@/lib/utils';

const MAC_MAP: Record<string, string> = {
  mod: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧',
  enter: '↵', escape: 'Esc', backspace: '⌫',
  tab: '⇥', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  space: '␣', delete: '⌦',
};

const WIN_MAP: Record<string, string> = {
  mod: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift',
  enter: 'Enter', escape: 'Esc', backspace: '⌫',
  tab: 'Tab', space: 'Space', delete: 'Del',
};

function formatKey(key: string, isMac: boolean): string {
  const lower = key.toLowerCase();
  const map = isMac ? MAC_MAP : WIN_MAP;
  return map[lower] ?? key.toUpperCase();
}

export interface KeyboardHintProps {
  /** Combo string like 'mod+k', 'mod+enter', 'escape' */
  combo?: string;
  /** Or provide pre-formatted keys */
  keys?: string[];
  className?: string;
  size?: 'sm' | 'md';
}

export function KeyboardHint({ combo, keys, className, size = 'sm' }: KeyboardHintProps) {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const displayKeys: string[] = keys ?? (combo
    ? combo.split('+').map(k => formatKey(k, isMac))
    : []);

  if (displayKeys.length === 0) return null;

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {displayKeys.map((k, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center rounded border border-border bg-muted font-mono font-medium text-muted-foreground select-none',
            size === 'sm'
              ? 'text-[10px] px-1 py-0.5 min-w-[18px] h-[18px]'
              : 'text-xs px-1.5 py-1 min-w-[22px]',
          )}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}
