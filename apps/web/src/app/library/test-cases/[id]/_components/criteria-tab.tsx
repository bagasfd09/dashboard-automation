'use client';

import { CheckSquare } from 'lucide-react';
import { parseCriteria } from '@/lib/steps-utils';
import type { useLibraryTestCase } from '@/hooks/use-library';

type TestCaseData = NonNullable<ReturnType<typeof useLibraryTestCase>['data']>;

export function CriteriaTab({ tc }: { tc: TestCaseData }) {
  const criteria = parseCriteria(tc.expectedOutcome);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceptance Criteria</h3>
      {criteria.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No acceptance criteria defined yet.</p>
      ) : (
        <div className="space-y-2">
          {criteria.map(c => (
            <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="w-5 h-5 rounded border-2 border-muted-foreground/30 flex items-center justify-center shrink-0 mt-0.5">
                <CheckSquare className="w-3 h-3 text-muted-foreground/50" />
              </div>
              <p className="text-sm leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
