'use client';

import { useMemo } from 'react';
import { similarityScore, matchType } from '@/lib/fuzzy-match';

interface FuzzyCandidate {
  id: string;
  title: string;
  [key: string]: unknown;
}

interface FuzzyResult<T> {
  item: T;
  score: number;
  matchType: 'exact' | 'high' | 'medium' | 'low';
}

/**
 * Hook for client-side fuzzy matching of a query against a list of candidates.
 * Returns matches sorted by score (highest first), filtered by minimum score.
 */
export function useFuzzyMatch<T extends FuzzyCandidate>(
  query: string,
  candidates: T[],
  options: { minScore?: number; maxResults?: number } = {},
): FuzzyResult<T>[] {
  const { minScore = 50, maxResults = 10 } = options;

  return useMemo(() => {
    if (!query.trim() || candidates.length === 0) return [];

    return candidates
      .map(item => {
        const score = similarityScore(query, item.title);
        return { item, score, matchType: matchType(score) };
      })
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }, [query, candidates, minScore, maxResults]);
}
