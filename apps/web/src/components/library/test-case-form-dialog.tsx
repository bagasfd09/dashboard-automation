'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ValidatedInput } from '@/components/ui/validated-input';
import { ValidatedTextarea } from '@/components/ui/validated-textarea';
import { SmartButton } from '@/components/ui/smart-button';
import { TagInput } from '@/components/ui/tag-input';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { cn } from '@/lib/utils';
import type { TestPriority, TestDifficulty, LibraryTestCaseStatus } from '@/lib/types';

// ── Priority dots ────────────────────────────────────────────────────────────

const PRIORITY_META: { value: TestPriority; label: string; dot: string; description: string }[] = [
  { value: 'P0', label: 'P0 Critical', dot: 'bg-red-500',    description: 'Must pass for release' },
  { value: 'P1', label: 'P1 High',     dot: 'bg-orange-500', description: 'Important for release' },
  { value: 'P2', label: 'P2 Medium',   dot: 'bg-yellow-500', description: 'Nice to have' },
  { value: 'P3', label: 'P3 Low',      dot: 'bg-green-500',  description: 'Low priority' },
];

const DIFFICULTY_META: { value: TestDifficulty; label: string }[] = [
  { value: 'EASY',   label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD',   label: 'Hard' },
  { value: 'COMPLEX', label: 'Complex' },
];

const STATUS_OPTIONS: { value: LibraryTestCaseStatus; label: string }[] = [
  { value: 'DRAFT',      label: 'Draft' },
  { value: 'ACTIVE',     label: 'Active' },
  { value: 'DEPRECATED', label: 'Deprecated' },
  { value: 'ARCHIVED',   label: 'Archived' },
];

// ── Step editor row ──────────────────────────────────────────────────────────

interface StepRow {
  id: string;
  text: string;
}

function StepEditor({
  steps,
  onChange,
}: {
  steps: StepRow[];
  onChange: (steps: StepRow[]) => void;
}) {
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  function addStep(afterIndex?: number) {
    const newStep: StepRow = { id: crypto.randomUUID(), text: '' };
    const idx = afterIndex != null ? afterIndex + 1 : steps.length;
    const next = [...steps];
    next.splice(idx, 0, newStep);
    onChange(next);
    // Focus the new input after render
    requestAnimationFrame(() => {
      inputRefs.current.get(newStep.id)?.focus();
    });
  }

  function removeStep(idx: number) {
    if (steps.length <= 1) return;
    onChange(steps.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, text: string) {
    onChange(steps.map((s, i) => i === idx ? { ...s, text } : s));
  }

  function handleKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'Tab' && !e.shiftKey && idx === steps.length - 1) {
      // Tab on last step → auto-create next
      e.preventDefault();
      addStep(idx);
    }
    if (e.key === 'Backspace' && steps[idx].text === '' && steps.length > 1) {
      e.preventDefault();
      removeStep(idx);
      // Focus previous
      const prevId = steps[idx - 1]?.id;
      if (prevId) requestAnimationFrame(() => inputRefs.current.get(prevId)?.focus());
    }
  }

  return (
    <div className="space-y-1.5">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2 group">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <Input
            ref={el => { if (el) inputRefs.current.set(step.id, el); }}
            value={step.text}
            onChange={e => updateStep(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            placeholder={`Step ${i + 1}...`}
            className="flex-1 h-8 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={() => removeStep(i)}
            disabled={steps.length <= 1}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-muted-foreground h-7"
        onClick={() => addStep()}
      >
        <Plus className="w-3 h-3 mr-1" /> Add step
      </Button>
    </div>
  );
}

// ── Criteria editor ──────────────────────────────────────────────────────────

function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: StepRow[];
  onChange: (criteria: StepRow[]) => void;
}) {
  function addCriterion() {
    onChange([...criteria, { id: crypto.randomUUID(), text: '' }]);
  }

  function removeCriterion(idx: number) {
    onChange(criteria.filter((_, i) => i !== idx));
  }

  function updateCriterion(idx: number, text: string) {
    onChange(criteria.map((c, i) => i === idx ? { ...c, text } : c));
  }

  return (
    <div className="space-y-1.5">
      {criteria.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 group">
          <div className="w-4 h-4 rounded border-2 border-muted-foreground/30 shrink-0" />
          <Input
            value={c.text}
            onChange={e => updateCriterion(i, e.target.value)}
            placeholder={`Criterion ${i + 1}...`}
            className="flex-1 h-8 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={() => removeCriterion(i)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="ghost"
        className="text-xs text-muted-foreground h-7"
        onClick={addCriterion}
      >
        <Plus className="w-3 h-3 mr-1" /> Add criterion
      </Button>
    </div>
  );
}

// ── Code preview ─────────────────────────────────────────────────────────────

function CodePreview({ title, steps, tags }: { title: string; steps: StepRow[]; tags: string[] }) {
  const [copied, setCopied] = useState(false);
  const stepsCode = steps.filter(s => s.text).length
    ? steps.filter(s => s.text).map((s, i) => `    // Step ${i + 1}: ${s.text}`).join('\n')
    : '    // TODO: implement test steps';

  const code = `import { test, expect } from '@playwright/test';

test('${title || 'Untitled'}', async ({ page }) => {
${stepsCode}
});`;

  return (
    <div className="relative">
      <pre className="bg-muted rounded-lg p-3 text-[11px] font-mono leading-relaxed overflow-auto max-h-[200px] whitespace-pre">{code}</pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  );
}

// ── Main form dialog ─────────────────────────────────────────────────────────

export interface TestCaseFormData {
  title: string;
  description: string;
  priority: TestPriority;
  difficulty: TestDifficulty;
  status: LibraryTestCaseStatus;
  tags: string[];
  preconditions: string;
  steps: string;
  expectedOutcome: string;
  changeNotes?: string;
  appVersion?: string;
}

interface TestCaseFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TestCaseFormData) => Promise<void>;
  initial?: Partial<TestCaseFormData>;
  existingTitles?: string[];
  tagSuggestions?: { label: string; count?: number }[];
}

function parseStepsToRows(raw: string): StepRow[] {
  if (!raw.trim()) return [{ id: crypto.randomUUID(), text: '' }];
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => ({
    id: crypto.randomUUID(),
    text: l.replace(/^\d+[\.\)]\s*/, ''),
  }));
}

function parseCriteriaToRows(raw: string): StepRow[] {
  if (!raw.trim()) return [];
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(l => ({
    id: crypto.randomUUID(),
    text: l.replace(/^[-*•□☐]\s*/, ''),
  }));
}

export function TestCaseFormDialog({
  mode,
  open,
  onClose,
  onSubmit,
  initial = {},
  existingTitles = [],
  tagSuggestions = [
    { label: 'smoke' }, { label: 'regression' }, { label: 'e2e' },
    { label: 'critical' }, { label: 'integration' }, { label: 'ui' }, { label: 'api' },
  ],
}: TestCaseFormDialogProps) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [priority, setPriority] = useState<TestPriority>(initial.priority ?? 'P2');
  const [difficulty, setDifficulty] = useState<TestDifficulty>(initial.difficulty ?? 'MEDIUM');
  const [status, setStatus] = useState<LibraryTestCaseStatus>(initial.status ?? 'DRAFT');
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [preconditions, setPreconditions] = useState(initial.preconditions ?? '');
  const [steps, setSteps] = useState<StepRow[]>(parseStepsToRows(initial.steps ?? ''));
  const [criteria, setCriteria] = useState<StepRow[]>(parseCriteriaToRows(initial.expectedOutcome ?? ''));
  const [changeNotes, setChangeNotes] = useState('');
  const [appVersion, setAppVersion] = useState(initial.appVersion ?? '');

  // Debounced duplicate detection
  const [dupWarning, setDupWarning] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = title.trim().toLowerCase();
      if (trimmed && existingTitles.some(t => t.toLowerCase() === trimmed && t !== initial.title)) {
        setDupWarning('A test case with this title already exists');
      } else {
        setDupWarning('');
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, existingTitles, initial.title]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    const stepsText = steps.filter(s => s.text.trim()).map((s, i) => `${i + 1}. ${s.text}`).join('\n');
    const criteriaText = criteria.filter(c => c.text.trim()).map(c => c.text).join('\n');
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      difficulty,
      status,
      tags,
      preconditions: preconditions.trim(),
      steps: stepsText,
      expectedOutcome: criteriaText,
      changeNotes: changeNotes.trim() || undefined,
      appVersion: appVersion.trim() || undefined,
    });
  }, [title, description, priority, difficulty, status, tags, preconditions, steps, criteria, changeNotes, appVersion, onSubmit]);

  useKeyboardShortcut('mod+enter', () => { if (open && title.trim()) handleSubmit(); }, { when: open });

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto animate-slide-in-up">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Test Case' : 'Edit Test Case'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title with duplicate detection */}
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <ValidatedInput
              autoFocus
              value={title}
              onChange={setTitle}
              placeholder="e.g. Verify checkout with 3DS card"
              validate={v => {
                if (!v.trim()) return { state: 'error', message: 'Title is required' };
                if (dupWarning) return { state: 'warning', message: dupWarning };
                return { state: 'valid' };
              }}
              validateOn="change"
            />
          </div>

          {/* Priority with colored dots */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex gap-1.5">
                {PRIORITY_META.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    title={p.description}
                    className={cn(
                      'flex-1 py-1.5 rounded text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5',
                      priority === p.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full', p.dot)} />
                    {p.value}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <div className="flex gap-1.5">
                {DIFFICULTY_META.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    className={cn(
                      'flex-1 py-1.5 rounded text-[10px] font-semibold border transition-colors',
                      difficulty === d.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagInput
              value={tags}
              onChange={setTags}
              placeholder="Add tag…"
              suggestions={tagSuggestions}
            />
          </div>

          {/* Description (expanded) */}
          <CollapsibleSection title="Description" defaultOpen>
            <ValidatedTextarea
              value={description}
              onChange={setDescription}
              placeholder="Describe what this test case covers..."
              minRows={2}
              maxRows={6}
              maxLength={2000}
            />
          </CollapsibleSection>

          {/* Steps (collapsed) */}
          <CollapsibleSection title="Steps" badge={steps.filter(s => s.text).length || undefined}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Preconditions</Label>
                <ValidatedTextarea
                  value={preconditions}
                  onChange={setPreconditions}
                  placeholder="e.g. User is logged in, cart has items..."
                  minRows={2}
                  maxRows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Test Steps</Label>
                <StepEditor steps={steps} onChange={setSteps} />
              </div>
            </div>
          </CollapsibleSection>

          {/* Acceptance Criteria (collapsed) */}
          <CollapsibleSection title="Acceptance Criteria" badge={criteria.filter(c => c.text).length || undefined}>
            <CriteriaEditor criteria={criteria} onChange={setCriteria} />
          </CollapsibleSection>

          {/* Code Template (collapsed) */}
          <CollapsibleSection title="Code Template">
            <CodePreview title={title} steps={steps} tags={tags} />
          </CollapsibleSection>

          {/* Advanced (collapsed) */}
          <CollapsibleSection title="Advanced">
            <div className="space-y-3">
              {mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {STATUS_OPTIONS.map(s => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setStatus(s.value)}
                        className={cn(
                          'px-3 py-1 rounded text-xs font-semibold border transition-colors',
                          status === s.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">App Version</Label>
                <Input
                  value={appVersion}
                  onChange={e => setAppVersion(e.target.value)}
                  placeholder="e.g. v2.1.0"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Change notes (edit mode only) */}
          {mode === 'edit' && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <Label>Change Notes <span className="text-destructive">*</span></Label>
              <ValidatedInput
                value={changeNotes}
                onChange={setChangeNotes}
                placeholder="e.g. Added 3DS verification step"
                validate={v => {
                  if (!v.trim()) return { state: 'error', message: 'Change notes are required when editing' };
                  return { state: 'valid' };
                }}
                validateOn="change"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {mode === 'create' ? (
            <>
              <SmartButton
                variant="outline"
                onClick={async () => {
                  setStatus('DRAFT');
                  await handleSubmit();
                }}
                disabled={!title.trim()}
                loadingText="Saving..."
                successText="Saved!"
              >
                Save as Draft
              </SmartButton>
              <SmartButton
                onClick={async () => {
                  setStatus('ACTIVE');
                  await handleSubmit();
                }}
                disabled={!title.trim()}
                loadingText="Saving..."
                successText="Saved!"
              >
                Save &amp; Activate
              </SmartButton>
            </>
          ) : (
            <SmartButton
              onClick={handleSubmit}
              disabled={!title.trim() || !changeNotes.trim()}
              loadingText="Saving…"
              successText="Saved!"
            >
              Save Changes
            </SmartButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
