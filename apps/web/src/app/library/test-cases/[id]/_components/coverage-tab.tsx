'use client';

import Link from 'next/link';
import { Link2, ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LibraryStatusBadge } from '@/components/library-badges';
import { useFuzzyMatches } from '@/hooks/use-library';
import { cn } from '@/lib/utils';
import type { useLibraryTestCase } from '@/hooks/use-library';

type TestCaseData = NonNullable<ReturnType<typeof useLibraryTestCase>['data']>;

function scoreColor(score: number): string {
  if (score >= 90) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
  if (score >= 70) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
}

function scoreEmoji(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  return '🔵';
}

export function CoverageTab({ tc }: { tc: TestCaseData }) {
  const linked = tc.linkedTestCases ?? [];
  const deps = tc.dependencies ?? [];
  const dependents = tc.dependents ?? [];
  const { data: fuzzyMatches } = useFuzzyMatches(tc.id);

  return (
    <div className="space-y-6">
      {/* Linked tests */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Linked Automated Tests ({linked.length})
        </h3>
        {linked.length === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-lg">
              <Link2 className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No linked tests</p>
              <p className="text-xs text-muted-foreground mt-1">No automated test cases are linked to this library entry.</p>
            </div>

            {/* Fuzzy match suggestions for unlinked */}
            {fuzzyMatches && fuzzyMatches.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">Suggested matches</h4>
                {fuzzyMatches.map(m => (
                  <Card key={m.testCaseId} className="bg-card border-border hover:border-primary/40 transition-colors">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.testCaseTitle}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{m.filePath}</p>
                        </div>
                        <Badge className={cn('text-xs shrink-0', scoreColor(m.score))}>
                          {scoreEmoji(m.score)} {Math.round(m.score)}%
                        </Badge>
                        <Button size="sm" variant="outline" className="shrink-0 text-xs">
                          <Check className="w-3 h-3 mr-1" />Link
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {linked.map(l => (
              <Card key={l.id} className="bg-card border-border">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{l.testCase.title}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{l.testCase.filePath}</p>
                    </div>
                    {l.autoMatched && <Badge variant="secondary" className="text-xs shrink-0">Auto-matched</Badge>}
                    {l.testCase.team && (
                      <Link href={`/teams/${l.testCase.team.id}`}>
                        <Badge variant="outline" className="text-xs shrink-0 cursor-pointer hover:border-primary/50">
                          {l.testCase.team.name}<ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </Badge>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(deps.length > 0 || dependents.length > 0) && (
        <>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Depends On</h3>
              {deps.length === 0 ? <p className="text-xs text-muted-foreground">No dependencies.</p>
                : deps.map(d => (
                  <Link key={d.dependsOn.id} href={`/library/test-cases/${d.dependsOn.id}`}>
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/40 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs flex-1 truncate">{d.dependsOn.title}</span>
                      <LibraryStatusBadge status={d.dependsOn.status} />
                    </div>
                  </Link>
                ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required By</h3>
              {dependents.length === 0 ? <p className="text-xs text-muted-foreground">No dependents.</p>
                : dependents.map(d => (
                  <Link key={d.libraryTestCase.id} href={`/library/test-cases/${d.libraryTestCase.id}`}>
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/40 transition-colors">
                      <span className="text-xs flex-1 truncate">{d.libraryTestCase.title}</span>
                      <LibraryStatusBadge status={d.libraryTestCase.status} />
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
