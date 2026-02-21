const PALETTE = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-green-500/20 text-green-400 border-green-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-rose-500/20 text-rose-400 border-rose-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30',
];

/** Deterministic color class for a team based on its ID. */
export function teamColorClass(teamId: string): string {
  let hash = 0;
  for (const ch of teamId) {
    hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}
