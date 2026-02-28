'use client';

import { useState } from 'react';
import { TrendingUp, Bug, RefreshCw, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SmartButton } from '@/components/ui/smart-button';
import { ValidatedTextarea } from '@/components/ui/validated-textarea';
import { useCreateSuggestion } from '@/hooks/use-library';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SuggestionType } from '@/lib/types';

const SUGGESTION_TYPES: {
  value: SuggestionType;
  label: string;
  emoji: string;
  description: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  { value: 'IMPROVEMENT', label: 'Update step',    emoji: '📝', description: 'Suggest a better approach or clarification', icon: TrendingUp, iconClass: 'text-blue-500' },
  { value: 'BUG_REPORT',  label: 'Add step',       emoji: '➕', description: 'The test case has incorrect or misleading info', icon: Bug, iconClass: 'text-red-500' },
  { value: 'UPDATE',      label: 'Needs Update',   emoji: '🔄', description: 'Content is outdated and needs refreshing', icon: RefreshCw, iconClass: 'text-amber-500' },
  { value: 'OBSOLETE',    label: 'Deprecate',      emoji: '🗑️', description: 'This test case is no longer relevant', icon: Archive, iconClass: 'text-gray-500' },
];

const SUGGESTION_PLACEHOLDERS: Record<SuggestionType, string> = {
  IMPROVEMENT: 'What could be improved? e.g. "Step 3 should also verify the email confirmation"',
  BUG_REPORT:  'What\'s incorrect? e.g. "Step 2 says /cart but the correct path is /checkout/cart"',
  UPDATE:      'What has changed? e.g. "The checkout flow was redesigned in v2.1, steps 4-6 are wrong"',
  OBSOLETE:    'Why is this no longer relevant? e.g. "This feature was removed in the v3 rewrite"',
};

export function SuggestDialog({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [type, setType] = useState<SuggestionType>('IMPROVEMENT');
  const [content, setContent] = useState('');
  const create = useCreateSuggestion(id);

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg animate-slide-in-up">
        <DialogHeader><DialogTitle>Suggest an Update</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Three visual type cards in a row */}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTION_TYPES.map(t => {
                const selected = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50',
                    )}
                  >
                    <span className="text-lg shrink-0 mt-0.5">{t.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-snug">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Details with auto-grow */}
          <div className="space-y-1.5">
            <Label>Details <span className="text-destructive">*</span></Label>
            <ValidatedTextarea
              value={content}
              onChange={setContent}
              minRows={3}
              maxRows={8}
              placeholder={SUGGESTION_PLACEHOLDERS[type]}
              validate={v => {
                if (!v.trim()) return { state: 'error', message: 'Details are required' };
                return { state: 'valid' };
              }}
              validateOn="change"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <SmartButton
            disabled={!content.trim()}
            loadingText="Submitting…"
            successText="Submitted!"
            onClick={async () => {
              await create.mutateAsync({ type, content: content.trim() });
              toast.success('Suggestion submitted');
              setContent(''); onClose();
            }}
          >
            Submit Suggestion
          </SmartButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
