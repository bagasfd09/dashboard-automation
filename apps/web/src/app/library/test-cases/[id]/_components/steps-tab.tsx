'use client';

import { Card, CardContent } from '@/components/ui/card';
import { parseSteps } from '@/lib/steps-utils';
import type { useLibraryTestCase } from '@/hooks/use-library';

type TestCaseData = NonNullable<ReturnType<typeof useLibraryTestCase>['data']>;

export function StepsTab({ tc }: { tc: TestCaseData }) {
  const steps = parseSteps(tc.steps);

  return (
    <div className="space-y-5">
      {tc.preconditions && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preconditions</h3>
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-3 pb-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{tc.preconditions}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test Steps</h3>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No steps defined yet.</p>
        ) : (
          <div className="space-y-2">
            {steps.map(step => (
              <Card key={step.id} className="bg-card border-border">
                <CardContent className="pt-3 pb-3">
                  <div className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.num}
                    </span>
                    <p className="text-sm leading-relaxed pt-0.5">{step.text}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
