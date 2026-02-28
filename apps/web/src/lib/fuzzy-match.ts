/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/**
 * Word overlap score (Jaccard index) between two strings.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  wordsA.forEach(w => {
    if (wordsB.has(w)) intersection++;
  });
  const union = new Set(Array.from(wordsA).concat(Array.from(wordsB))).size;
  return intersection / union;
}

/**
 * Compute a similarity score (0-100) between two strings
 * using a combination of Levenshtein distance and word overlap.
 */
export function similarityScore(a: string, b: string): number {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();

  if (la === lb) return 100;
  if (!la || !lb) return 0;

  // Levenshtein-based similarity (0-1)
  const maxLen = Math.max(la.length, lb.length);
  const levSim = 1 - levenshtein(la, lb) / maxLen;

  // Word overlap (0-1)
  const wordSim = wordOverlap(la, lb);

  // Substring bonus
  const substringBonus = la.includes(lb) || lb.includes(la) ? 0.2 : 0;

  // Weighted combination
  const combined = levSim * 0.4 + wordSim * 0.5 + substringBonus * 0.1;

  return Math.round(Math.min(combined * 100, 100));
}

/**
 * Classify a score into a match type.
 */
export function matchType(score: number): 'exact' | 'high' | 'medium' | 'low' {
  if (score >= 95) return 'exact';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Find fuzzy matches for a query against a list of candidates.
 * Returns candidates sorted by score (highest first), filtered by minimum score.
 */
export function findFuzzyMatches<T extends { title: string }>(
  query: string,
  candidates: T[],
  minScore = 50,
): (T & { score: number; matchType: 'exact' | 'high' | 'medium' | 'low' })[] {
  return candidates
    .map(c => ({
      ...c,
      score: similarityScore(query, c.title),
      matchType: matchType(similarityScore(query, c.title)),
    }))
    .filter(c => c.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
