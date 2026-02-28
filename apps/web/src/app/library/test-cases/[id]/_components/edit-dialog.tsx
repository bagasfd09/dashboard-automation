'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SmartButton } from '@/components/ui/smart-button';
import { TagInput } from '@/components/ui/tag-input';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useUpdateLibraryTestCase } from '@/hooks/use-library';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus } from '@/lib/types';

const STATUS_LABELS: Record<LibraryTestCaseStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', DEPRECATED: 'Deprecated', ARCHIVED: 'Archived',
};

export function EditDialog({ id, initial, open, onClose }: {
  id: string;
  initial: {
    title: string; description: string; priority: TestPriority;
    difficulty: TestDifficulty; status: LibraryTestCaseStatus;
    tags: string[]; steps: string; preconditions: string; expectedOutcome: string;
  };
  open: boolean; onClose: () => void;
}) {
  const [form, setForm] = useState({ ...initial, changeNotes: '' });
  const [tags, setTags] = useState<string[]>(initial.tags);
  const update = useUpdateLibraryTestCase(id);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return;
    await update.mutateAsync({
      title: form.title.trim(), description: form.description.trim() || undefined,
      priority: form.priority, difficulty: form.difficulty, status: form.status, tags,
      steps: form.steps.trim() || undefined, preconditions: form.preconditions.trim() || undefined,
      expectedOutcome: form.expectedOutcome.trim() || undefined, changeNotes: form.changeNotes.trim() || undefined,
    });
    toast.success('Test case updated');
    onClose();
  };

  useKeyboardShortcut('mod+enter', () => { if (open && form.title.trim()) submit(); }, { when: open });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Test Case</DialogTitle></DialogHeader>
        <div className="space-y-4">

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input autoFocus value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          {/* Priority + Difficulty buttons */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex gap-1.5">
                {(['P0', 'P1', 'P2', 'P3'] as TestPriority[]).map(p => (
                  <button key={p} onClick={() => set('priority', p)}
                    className={cn(
                      'flex-1 py-1 rounded text-xs font-semibold border transition-colors',
                      form.priority === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50',
                    )}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div className="flex gap-1.5">
                {(['EASY', 'MEDIUM', 'HARD', 'COMPLEX'] as TestDifficulty[]).map(d => (
                  <button key={d} onClick={() => set('difficulty', d)}
                    className={cn(
                      'flex-1 py-1 rounded text-[10px] font-semibold border transition-colors',
                      form.difficulty === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50',
                    )}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-1.5 flex-wrap">
              {(['DRAFT', 'ACTIVE', 'DEPRECATED', 'ARCHIVED'] as LibraryTestCaseStatus[]).map(s => (
                <button key={s} onClick={() => set('status', s)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-semibold border transition-colors',
                    form.status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50',
                  )}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              placeholder="Add tag…"
              suggestions={[
                { label: 'smoke' }, { label: 'regression' }, { label: 'e2e' },
                { label: 'critical' }, { label: 'integration' }, { label: 'ui' }, { label: 'api' },
              ]}
            />
          </div>

          {/* Steps & Criteria */}
          <CollapsibleSection title="Steps & Criteria" defaultOpen>
            <div className="space-y-1.5">
              <Label>Preconditions</Label>
              <Textarea value={form.preconditions} onChange={e => set('preconditions', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Test Steps</Label>
              <Textarea value={form.steps} onChange={e => set('steps', e.target.value)} rows={6} placeholder={"1. Navigate to…\n2. Click…\n3. Verify…"} />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Outcome / Acceptance Criteria</Label>
              <Textarea value={form.expectedOutcome} onChange={e => set('expectedOutcome', e.target.value)} rows={3} />
            </div>
          </CollapsibleSection>

          {/* Advanced */}
          <CollapsibleSection title="Advanced">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Change Notes <span className="text-muted-foreground text-xs">(optional — describes what changed)</span></Label>
              <Input value={form.changeNotes} onChange={e => set('changeNotes', e.target.value)} placeholder="e.g. Added 3DS verification step" />
            </div>
          </CollapsibleSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <SmartButton
            onClick={submit}
            disabled={!form.title.trim()}
            loadingText="Saving…"
            successText="Saved!"
          >
            Save Changes
          </SmartButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
