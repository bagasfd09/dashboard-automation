'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SmartButton } from '@/components/ui/smart-button';
import { useUpdateRelease } from '@/hooks/use-releases';
import { toast } from '@/hooks/use-toast';
import type { ReleaseDetail } from '@/lib/types';

export function EditReleaseDialog({ release, open, onClose }: { release: ReleaseDetail; open: boolean; onClose: () => void }) {
  const update = useUpdateRelease(release.id);
  const [form, setForm] = useState({
    name: release.name,
    version: release.version,
    description: release.description ?? '',
    targetDate: release.targetDate ? new Date(release.targetDate).toISOString().split('T')[0] : '',
  });

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Release</DialogTitle></DialogHeader>
        <form
          onSubmit={async e => {
            e.preventDefault();
            try {
              await update.mutateAsync({
                name: form.name.trim(),
                version: form.version.trim(),
                description: form.description.trim() || undefined,
                targetDate: form.targetDate || null,
              });
              toast.success('Release updated');
              onClose();
            } catch (err) {
              toast.error((err as Error).message ?? 'Failed to update');
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Version <span className="text-red-500">*</span></Label>
              <Input value={form.version} onChange={e => set('version', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Target Date</Label>
            <Input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SmartButton
              type="submit"
              loadingText="Saving..."
              successText="Saved!"
            >
              Save Changes
            </SmartButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
