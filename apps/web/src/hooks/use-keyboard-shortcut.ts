import { useEffect, useCallback } from 'react';

type KeyCombo = string; // e.g. 'mod+k', 'escape', 'mod+enter', 'shift+?'

export interface KeyboardShortcutOptions {
  /** Only fire when this is true (default: true) */
  when?: boolean;
  /** Fire on keydown (default) or keyup */
  event?: 'keydown' | 'keyup';
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
}

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
}

/**
 * Parse a key combo string into mods + key.
 * e.g. 'mod+k' → { mods: Set(['mod']), key: 'k' }
 */
function parseCombo(combo: string): { mods: Set<string>; key: string } {
  const parts = combo.toLowerCase().split('+');
  return { mods: new Set(parts.slice(0, -1)), key: parts[parts.length - 1] };
}

function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const { mods, key } = parseCombo(combo);
  const isMac = isMacPlatform();

  const eKey = e.key.toLowerCase();
  const keyMatches = eKey === key;
  if (!keyMatches) return false;

  const wantsCtrl  = mods.has('ctrl');
  const wantsMod   = mods.has('mod');
  const wantsAlt   = mods.has('alt');
  const wantsShift = mods.has('shift');

  const modPressed = wantsMod ? (isMac ? e.metaKey : e.ctrlKey) : false;
  const ctrlOk  = wantsMod  ? modPressed : (wantsCtrl ? e.ctrlKey : !e.ctrlKey && !e.metaKey);
  const altOk   = wantsAlt  ? e.altKey   : !e.altKey;
  const shiftOk = wantsShift ? e.shiftKey : !e.shiftKey;

  return ctrlOk && altOk && shiftOk;
}

/**
 * Register a global keyboard shortcut (window-level).
 *
 * Usage:
 *   useKeyboardShortcut('mod+k', () => setOpen(true));
 *   useKeyboardShortcut('escape', close, { when: isOpen });
 *   useKeyboardShortcut('mod+enter', submit, { when: isFormValid });
 *   useKeyboardShortcut(['mod+s', 'mod+enter'], save);
 */
export function useKeyboardShortcut(
  combo: KeyCombo | KeyCombo[],
  handler: (e: KeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
) {
  const { when = true, event = 'keydown', preventDefault = true } = options;
  const stableHandler = useCallback(handler, [handler]);

  useEffect(() => {
    if (!when) return;

    const combos = Array.isArray(combo) ? combo : [combo];

    function onKey(e: KeyboardEvent) {
      // Skip if inside a text field — unless the combo uses a modifier or is escape
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      const hasMod = combos.some(c => c.includes('mod+') || c.includes('ctrl+'));
      const isEscape = combos.some(c => c === 'escape');
      if (inInput && !hasMod && !isEscape) return;

      if (!combos.some(c => matchesCombo(e, c))) return;

      if (preventDefault) e.preventDefault();
      stableHandler(e);
    }

    window.addEventListener(event, onKey);
    return () => window.removeEventListener(event, onKey);
  }, [when, combo, event, preventDefault, stableHandler]);
}
