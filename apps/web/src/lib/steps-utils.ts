export interface ParsedStep {
  id: string;
  num: number;
  text: string;
}

export interface ParsedCriterion {
  id: string;
  text: string;
}

/**
 * Parse newline-separated step text into structured step objects.
 * Strips numbered prefixes like "1." or "1)" from each line.
 */
export function parseSteps(raw: string | null): ParsedStep[] {
  if (!raw?.trim()) return [];
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map((l, i) => ({
      id: crypto.randomUUID(),
      num: i + 1,
      text: l.replace(/^\d+[\.\)]\s*/, ''),
    }));
}

/**
 * Parse newline-separated criteria text into structured criterion objects.
 * Strips bullet prefixes like "- ", "* ", "• ", "□ ", "☐ ".
 */
export function parseCriteria(raw: string | null): ParsedCriterion[] {
  if (!raw?.trim()) return [];
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => ({
      id: crypto.randomUUID(),
      text: l.replace(/^[-*•□☐]\s*/, ''),
    }));
}

/**
 * Serialize structured steps back to newline-separated numbered text.
 */
export function serializeSteps(steps: ParsedStep[]): string {
  return steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n');
}

/**
 * Serialize structured criteria back to newline-separated text.
 */
export function serializeCriteria(criteria: ParsedCriterion[]): string {
  return criteria.map(c => c.text).join('\n');
}
