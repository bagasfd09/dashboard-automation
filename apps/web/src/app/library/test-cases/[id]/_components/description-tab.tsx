'use client';

import Link from 'next/link';
import { Check, AlertTriangle, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LibraryStatusBadge } from '@/components/library-badges';
import type { useLibraryTestCase } from '@/hooks/use-library';

type TestCaseData = NonNullable<ReturnType<typeof useLibraryTestCase>['data']>;

export function DescriptionTab({ tc }: { tc: TestCaseData }) {
  return (
    <div className="space-y-6">
      {tc.description ? (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{tc.description}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">No description provided.</p>
      )}

      {/* Dependencies */}
      {(tc.dependencies ?? []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This test requires:</h3>
          {tc.dependencies!.map(dep => (
            <Link key={dep.dependsOn.id} href={`/library/test-cases/${dep.dependsOn.id}`}>
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                {dep.dependsOn.status === 'ACTIVE'
                  ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />}
                <span className="text-sm truncate flex-1">{dep.dependsOn.title}</span>
                <LibraryStatusBadge status={dep.dependsOn.status} className="shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Dependents */}
      {(tc.dependents ?? []).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required by:</h3>
          {tc.dependents!.map(dep => (
            <Link key={dep.libraryTestCase.id} href={`/library/test-cases/${dep.libraryTestCase.id}`}>
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{dep.libraryTestCase.title}</span>
                <LibraryStatusBadge status={dep.libraryTestCase.status} className="shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Meta info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {[
          { label: 'Collection', value: tc.collection?.name ?? 'None' },
          { label: 'Created by', value: tc.createdBy?.name ?? 'Unknown' },
          { label: 'Bookmarks', value: String(tc._count?.bookmarks ?? 0) },
          { label: 'Suggestions', value: String(tc._count?.suggestions ?? 0) },
        ].map(m => (
          <Card key={m.label} className="bg-muted/50 border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-muted-foreground mb-0.5">{m.label}</p>
              <p className="font-semibold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
