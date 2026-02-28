'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { parseSteps } from '@/lib/steps-utils';
import type { TestPriority } from '@/lib/types';

export function CodeTemplateDialog({ tc, open, onClose }: {
  tc: { title: string; steps: string | null; collection?: { name: string } | null; priority: TestPriority; tags: string[] };
  open: boolean; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const steps = parseSteps(tc.steps);
  const stepsCode = steps.length
    ? steps.map(s => `      // Step ${s.num}: ${s.text}`).join('\n')
    : '      // TODO: implement test steps';

  const code = `// Generated from Library: "${tc.title}"
// Collection: ${tc.collection?.name ?? 'N/A'} | Priority: ${tc.priority}
// Tags: ${tc.tags.join(', ') || 'none'}

import { test, expect } from '@playwright/test';

test.describe('${tc.collection?.name ?? 'Library'}', () => {
  test('${tc.title}', async ({ page }) => {
${stepsCode}
  });
});`;

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Code template copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Playwright Code Template</DialogTitle></DialogHeader>
        <div className="relative flex-1 overflow-hidden">
          <pre className="bg-muted rounded-lg p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[60vh] whitespace-pre">
            {code}
          </pre>
          <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-7 w-7" onClick={copy}>
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={copy}>{copied ? 'Copied!' : 'Copy to Clipboard'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
