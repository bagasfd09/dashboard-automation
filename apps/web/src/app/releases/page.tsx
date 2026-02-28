'use client';

import { Suspense, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Package, Plus, Calendar, Users, CheckSquare, Clock, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReleasesListSkeleton } from '@/components/skeletons';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { useReleases, useCreateRelease } from '@/hooks/use-releases';
import { useLibraryTestCases } from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { useTeams } from '@/hooks/use-teams';
import type { Release, ReleaseStatus, UserRole } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAN_MANAGE: UserRole[] = ['ADMIN', 'MANAGER', 'TEAM_LEAD'];

function relativeDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  return new Date(d).toLocaleDateString();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusMeta(status: ReleaseStatus) {
  switch (status) {
    case 'DRAFT':       return { label: 'Draft',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',  border: 'border-l-gray-300 dark:border-l-gray-600' };
    case 'IN_PROGRESS': return { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',  border: 'border-l-blue-400' };
    case 'BLOCKED':     return { label: 'Blocked',    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',      border: 'border-l-red-500' };
    case 'RELEASED':    return { label: 'Released',   color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400', border: 'border-l-green-500' };
    case 'CANCELLED':   return { label: 'Cancelled',  color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',  border: 'border-l-gray-400' };
  }
}

/** Get the upcoming Friday as YYYY-MM-DD */
function getUpcomingFriday(weeksAhead: 0 | 1 = 0): string {
  const now = new Date();
  const day = now.getDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7;
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntilFriday + weeksAhead * 7);
  return target.toISOString().slice(0, 10);
}

function fmtShortDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type QuickStartOption = 'empty' | 'p0' | 'p0p1';

// ── Release Card ──────────────────────────────────────────────────────────────

function ReleaseCard({ release }: { release: Release }) {
  const { label, color, border } = statusMeta(release.status);
  const total = release._count?.checklistItems ?? 0;
  const isOverdue = release.targetDate && !['RELEASED', 'CANCELLED'].includes(release.status) && Date.now() > new Date(release.targetDate).getTime();

  return (
    <Link href={`/releases/${release.id}`}>
      <Card className={cn('bg-card border-border border-l-4 cursor-pointer hover:shadow-md transition-shadow', border)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Package className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate">
                  {release.name} — <span className="text-muted-foreground font-normal">{release.version}</span>
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {release.team && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {release.team.name}
                    </span>
                  )}
                  {release.targetDate && (
                    <span className={cn('flex items-center gap-1', isOverdue && 'text-red-500 dark:text-red-400')}>
                      <Calendar className="w-3 h-3" />
                      Target: {fmtDate(release.targetDate)}
                      {isOverdue && ' (overdue)'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge className={cn('shrink-0 text-[10px] rounded-full', color)}>{label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {total > 0 && (
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{total} checklist {total === 1 ? 'item' : 'items'}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              Created by {release.createdBy?.name ?? 'Unknown'} · {relativeDate(release.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-end">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Create Release Dialog ─────────────────────────────────────────────────────

function CreateReleaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { data: teams } = useTeams();
  const { data: releasesData } = useReleases({ pageSize: 100 });
  const create = useCreateRelease();
  const [form, setForm] = useState({ name: '', description: '', teamId: '__none__', targetDate: '' });
  const [quickStart, setQuickStart] = useState<QuickStartOption>('empty');

  const { data: p0Data } = useLibraryTestCases({ priority: 'P0', status: 'ACTIVE', pageSize: 1 });
  const { data: p1Data } = useLibraryTestCases({ priority: 'P1', status: 'ACTIVE', pageSize: 1 });
  const p0Count = p0Data?.pagination?.totalItems ?? 0;
  const p1Count = p1Data?.pagination?.totalItems ?? 0;

  const lastRelease = useMemo(() => {
    const all = releasesData?.data ?? [];
    if (all.length === 0) return null;
    return [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [releasesData]);

  const thisFri = useMemo(() => getUpcomingFriday(0), []);
  const nextFri = useMemo(() => getUpcomingFriday(1), []);

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }
  const canSubmit = form.name.trim() !== '';

  async function handleCreate() {
    if (!canSubmit) return;
    const trimmedName = form.name.trim();
    const release = await create.mutateAsync({
      name: trimmedName,
      version: trimmedName,
      description: form.description.trim() || undefined,
      teamId: form.teamId !== '__none__' ? form.teamId : undefined,
      targetDate: form.targetDate || undefined,
    });
    toast.success('Release created');
    onClose();
    router.push(`/releases/${release.id}`);
  }

  useKeyboardShortcut('mod+enter', () => { if (open && canSubmit) handleCreate(); }, { when: open });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Release</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Single name field */}
          <div className="space-y-1.5">
            <Label>Release Name <span className="text-red-500">*</span></Label>
            <Input autoFocus placeholder="v2.2.0" value={form.name} onChange={e => set('name', e.target.value)} />
            {lastRelease && (
              <p className="text-xs text-muted-foreground">
                Last release: {lastRelease.name} — {lastRelease.status === 'RELEASED' ? 'Released' : 'Created'} {relativeDate(lastRelease.releasedAt ?? lastRelease.createdAt)}
              </p>
            )}
          </div>

          {/* Target Date + Quick Picks */}
          <div className="space-y-1.5">
            <Label>Target Date</Label>
            <Input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} />
            <div className="flex items-center gap-2 pt-0.5">
              {[
                { date: thisFri, label: `This Fri (${fmtShortDate(thisFri)})` },
                { date: nextFri, label: `Next Fri (${fmtShortDate(nextFri)})` },
              ].map(opt => (
                <button key={opt.date} type="button" onClick={() => set('targetDate', opt.date)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-md border transition-colors',
                    form.targetDate === opt.date
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Start radios */}
          <div className="space-y-1.5">
            <Label>Quick Start</Label>
            <div className="flex flex-col gap-1.5">
              {([
                { value: 'empty' as const, label: 'Start empty' },
                { value: 'p0' as const, label: `Add all P0 (${p0Count})` },
                { value: 'p0p1' as const, label: `Add P0+P1 (${p0Count + p1Count})` },
              ]).map(opt => (
                <button key={opt.value} type="button" onClick={() => setQuickStart(opt.value)}
                  className={cn(
                    'flex items-center gap-2.5 text-sm px-3 py-2 rounded-md border transition-colors text-left',
                    quickStart === opt.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50',
                  )}>
                  <span className={cn('w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center',
                    quickStart === opt.value ? 'border-primary' : 'border-muted-foreground/40')}>
                    {quickStart === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Details */}
          <CollapsibleSection title="Optional Details">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional release notes..." rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={form.teamId} onValueChange={v => set('teamId', v)}>
                <SelectTrigger><SelectValue placeholder="Any team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Any team</SelectItem>
                  {teams?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CollapsibleSection>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SmartButton onClick={handleCreate} disabled={!canSubmit} loadingText="Creating..." successText="Created!">
              Create Release
            </SmartButton>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Active Tab ────────────────────────────────────────────────────────────────

function ActiveTab({ canManage }: { canManage: boolean }) {
  const { data, isLoading } = useReleases({ pageSize: 100 });
  const releases = (data?.data ?? []).filter(r => !['RELEASED', 'CANCELLED'].includes(r.status));

  if (isLoading) return <ReleasesListSkeleton />;

  if (releases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <Package className="w-14 h-14 text-muted-foreground/40" />
        <div>
          <p className="font-medium text-foreground">No active releases</p>
          <p className="text-sm text-muted-foreground mt-1">Create a release checklist to track quality before shipping.</p>
        </div>
      </div>
    );
  }

  const draft = releases.filter(r => r.status === 'DRAFT');
  const inProgress = releases.filter(r => r.status === 'IN_PROGRESS');
  const blocked = releases.filter(r => r.status === 'BLOCKED');

  const groups = [
    { label: 'Blocked', items: blocked, color: 'text-red-600 dark:text-red-400' },
    { label: 'In Progress', items: inProgress, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Draft', items: draft, color: 'text-muted-foreground' },
  ].filter(g => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map(g => (
        <div key={g.label} className="space-y-3">
          <h3 className={cn('text-xs font-semibold uppercase tracking-wider', g.color)}>{g.label} ({g.items.length})</h3>
          {g.items.map(r => <ReleaseCard key={r.id} release={r} />)}
        </div>
      ))}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading } = useReleases({ pageSize: 100 });
  const releases = (data?.data ?? []).filter(r => ['RELEASED', 'CANCELLED'].includes(r.status));
  const router = useRouter();

  if (isLoading) return <ReleasesListSkeleton />;

  // Stats from data
  const allReleases = data?.data ?? [];
  const totalReleased = allReleases.filter(r => r.status === 'RELEASED').length;
  const totalCancelled = allReleases.filter(r => r.status === 'CANCELLED').length;
  const thisMonth = allReleases.filter(r => {
    const now = new Date();
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Releases', value: allReleases.length },
          { label: 'Released', value: totalReleased },
          { label: 'Cancelled', value: totalCancelled },
          { label: 'This Month', value: thisMonth },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History table */}
      {releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <Package className="w-12 h-12 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No release history yet</p>
            <p className="text-sm text-muted-foreground mt-1">Releases will appear here after they are completed or cancelled.</p>
          </div>
        </div>
      ) : (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Release</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Released / Cancelled</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map(r => {
                const { label, color } = statusMeta(r.status);
                return (
                  <TableRow
                    key={r.id}
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/releases/${r.id}`)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.version}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.team?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px] rounded-full', color)}>{label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r._count?.checklistItems ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.releasedAt ? fmtDate(r.releasedAt) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.createdBy?.name ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ReleasesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const tab = searchParams.get('tab') ?? 'active';
  const canManage = user?.role ? CAN_MANAGE.includes(user.role) : false;
  const [createOpen, setCreateOpen] = useState(false);

  // Count active releases for tab badge
  const { data: allData } = useReleases({ pageSize: 100 });
  const activeCount = (allData?.data ?? []).filter(r => !['RELEASED', 'CANCELLED'].includes(r.status)).length;
  const historyCount = (allData?.data ?? []).filter(r => ['RELEASED', 'CANCELLED'].includes(r.status)).length;

  const tabs = [
    { id: 'active', label: 'Active', count: activeCount },
    { id: 'history', label: 'History', count: historyCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Releases</h1>
          <p className="text-sm text-muted-foreground mt-1">Track release readiness and history</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Release
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => router.push(t.id === 'active' ? '/releases' : `/releases?tab=${t.id}`)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
            )}
          >
            {t.label}
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
              tab === t.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
            )}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'active' && <ActiveTab canManage={canManage} />}
      {tab === 'history' && <HistoryTab />}

      {/* Create dialog */}
      <CreateReleaseDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

export default function ReleasesPage() {
  return (
    <Suspense fallback={<ReleasesListSkeleton />}>
      <ReleasesContent />
    </Suspense>
  );
}
