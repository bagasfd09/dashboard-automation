'use client';

/**
 * EmojiPicker — Lightweight emoji grid with search + recently used.
 *
 * Usage:
 *   <EmojiPicker value={icon} onChange={setIcon} />
 *   <EmojiPicker value={icon} onChange={setIcon} placeholder="📁" />
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = [
  {
    label: 'Common',
    emojis: [
      '✅','❌','⚠️','🔥','⭐','💡','🔧','🔍','📊','📋',
      '🧪','🚀','🎯','✨','💬','📝','🔗','🗂️','📁','📌',
    ],
  },
  {
    label: 'Faces',
    emojis: [
      '😀','😎','🤔','😅','🥳','😤','🤩','🙁','😱','🫡',
      '🤓','🥸','😶','🫢','😏',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '🟢','🔴','🟡','🔵','🟠','⚡','💥','🎉','🏆','🛡️',
      '⚙️','🔑','🌐','📡','🧩','🎲','🪄','🔮','📦','🧲',
    ],
  },
  {
    label: 'Nature',
    emojis: [
      '🌿','🌊','☀️','❄️','🌈','🌙','⛅','🌻','🍀','🦋',
    ],
  },
];

const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap(c => c.emojis);
const RECENT_KEY = 'emoji-picker-recent';

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveRecent(emoji: string) {
  try {
    const prev = getRecent().filter(e => e !== emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify([emoji, ...prev].slice(0, 10)));
  } catch { /* no-op */ }
}

function EmojiGrid({ emojis, onSelect }: { emojis: string[]; onSelect: (e: string) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {emojis.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onSelect(e)}
          className="w-8 h-8 text-lg rounded hover:bg-accent transition-colors flex items-center justify-center"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export interface EmojiPickerProps {
  value?: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
  className?: string;
}

export function EmojiPicker({ value, onChange, placeholder = '😀', className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<string[]>([]);

  function handleOpen() {
    setRecent(getRecent());
    setSearch('');
    setOpen(true);
  }

  function select(emoji: string) {
    saveRecent(emoji);
    setRecent(getRecent());
    onChange(emoji);
    setOpen(false);
  }

  const filtered = search
    ? ALL_EMOJIS.filter(e => e.includes(search))
    : null;

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={open ? () => setOpen(false) : handleOpen}
        className="flex items-center justify-center w-10 h-10 rounded-md border border-input bg-background hover:bg-accent transition-colors text-lg"
        aria-label="Pick emoji"
      >
        {value || placeholder}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-12 left-0 w-72 bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 text-sm px-2.5 rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
            />

            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {filtered ? (
                filtered.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Results</p>
                    <EmojiGrid emojis={filtered} onSelect={select} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No emojis found</p>
                )
              ) : (
                <>
                  {recent.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Recent</p>
                      <EmojiGrid emojis={recent} onSelect={select} />
                    </div>
                  )}
                  {EMOJI_CATEGORIES.map(cat => (
                    <div key={cat.label}>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">{cat.label}</p>
                      <EmojiGrid emojis={cat.emojis} onSelect={select} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
