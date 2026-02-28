'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Package,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  AlertTriangle,
  SkipForward,
  Plus,
  Trash2,
  RotateCcw,
  ExternalLink,
  BookOpen,
  Edit,
  Ban,
  Users,
  Calendar,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InlineEdit } from '@/components/ui/inline-edit';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ReleaseDetailSkeleton } from '@/components/skeletons';
import { useRelease, useCancelRelease, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem, useDeleteRelease } from '@/hooks/use-releases';
import { useAuth } from '@/providers/AuthProvider';
import { EditReleaseDialog } from './_components/edit-release-dialog';
import { MarkReleasedDialog } from './_components/mark-released-dialog';
import { AddFromLibraryDialog } from './_components/add-from-library-dialog';
import type {
  ReleaseDetail,
  ReleaseChecklistItem,
  ChecklistItemStatus,
  UserRole,
  TestPriority,
} from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAN_MANAGE: UserRole[] = ['ADMIN', 'MANAGER', 'TEAM_LEAD'];
const CAN_CHECK: UserRole[] = ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER'];

function relDate(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const priorityColors: Record<TestPriority, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  P1: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  P2: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  P3: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function itemStatusIcon(status: ChecklistItemStatus) {
  switch (status) {
    case 'PASSED':      return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
    case 'FAILED':      return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
    case 'IN_PROGRESS': return <Clock className="w-5 h-5 text-blue-500 shrink-0" />;
    case 'BLOCKED':     return <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />;
    case 'SKIPPED':     return <SkipForward className="w-5 h-5 text-muted-foreground shrink-0" />;
    default:            return <Circle className="w-5 h-5 text-muted-foreground shrink-0" />;
  }
}

function itemBorderClass(status: ChecklistItemStatus) {
  switch (status) {
    case 'PASSED':      return 'border-l-green-500';
    case 'FAILED':      return 'border-l-red-500';
    case 'IN_PROGRESS': return 'border-l-blue-400';
    case 'BLOCKED':     return 'border-l-orange-400';
    default:            return 'border-l-muted-foreground/30 border-dashed';
  }
}

function computeProgress(items: ReleaseChecklistItem[]) {
  const total = items.length;
  const passed = items.filter(i => i.status === 'PASSED' || i.status === 'SKIPPED').length;
  const failed = items.filter(i => i.status === 'FAILED').length;
  const blocked = items.filter(i => i.status === 'BLOCKED').length;
  const pending = items.filter(i => i.status === 'PENDING').length;
  const inProgress = items.filter(i => i.status === 'IN_PROGRESS').length;
  return { total, passed, failed, blocked, pending, inProgress };
}

// ── Release status badge ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    RELEASED: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    CANCELLED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  const labels: Record<string, string> = {
    DRAFT: 'Draft', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked', RELEASED: 'Released', CANCELLED: 'Cancelled',
  };
  return <Badge className={cn('rounded-full text-[10px]', map[status] ?? '')}>{labels[status] ?? status}</Badge>;
}

// ── Checklist Item Row ────────────────────────────────────────────────────────

function ChecklistItemRow({
  item,
  releaseId,
  releaseStatus,
  canManage,
  canCheck,
}: {
  item: ReleaseChecklistItem;
  releaseId: string;
  releaseStatus: string;
  canManage: boolean;
  canCheck: boolean;
}) {
  const updateItem = useUpdateChecklistItem(releaseId);
  const deleteItem = useDeleteChecklistItem(releaseId);
  const readonly = ['RELEASED', 'CANCELLED'].includes(releaseStatus);

  async function toggleManual() {
    if (readonly || !canCheck || item.type !== 'MANUAL_TEST') return;
    const newStatus: ChecklistItemStatus = item.status === 'PASSED' ? 'PENDING' : 'PASSED';
    try {
      await updateItem.mutateAsync({ itemId: item.id, data: { status: newStatus } });
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to update');
    }
  }

  async function handleDelete() {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success('Item removed', {
        action: {
          label: 'Undo',
          onClick: () => {
            // Re-fetch to restore — best-effort undo
            // TODO: implement proper undo when backend supports it
          },
        },
      });
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to remove item');
    }
  }

  const isManual = item.type === 'MANUAL_TEST';
  const border = itemBorderClass(item.status);

  return (
    <Card className={cn('bg-card border-border border-l-4', border)}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-start gap-3">
          {/* Icon / checkbox */}
          {isManual ? (
            <button
              onClick={toggleManual}
              disabled={readonly || !canCheck}
              className="mt-0.5 disabled:cursor-not-allowed"
              aria-label="Toggle check"
            >
              {item.status === 'PASSED'
                ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                : <Circle className={cn('w-5 h-5', canCheck && !readonly ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50')} />
              }
            </button>
          ) : (
            <div className="mt-0.5">{itemStatusIcon(item.status)}</div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {isManual && canManage && !readonly ? (
              <InlineEdit
                value={item.title}
                onSave={async (v) => {
                  await updateItem.mutateAsync({ itemId: item.id, data: { title: v } });
                }}
                className="text-sm font-medium leading-tight"
              />
            ) : (
              <p className="text-sm font-medium leading-tight">{item.title}</p>
            )}

            {/* Library link */}
            {item.libraryTestCase && (
              <div className="flex items-center gap-1.5 mt-1">
                <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                <Link
                  href={`/library/test-cases/${item.libraryTestCase.id}`}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors truncate"
                  onClick={e => e.stopPropagation()}
                >
                  {item.libraryTestCase.collection?.name && `${item.libraryTestCase.collection.name} > `}
                  {item.libraryTestCase.title}
                </Link>
                <Badge className={cn('text-[9px] px-1 rounded shrink-0', priorityColors[item.libraryTestCase.priority])}>
                  {item.libraryTestCase.priority}
                </Badge>
              </div>
            )}

            {/* Manual completed info */}
            {isManual && item.completedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Checked {relDate(item.completedAt)}
              </p>
            )}

            {/* Notes */}
            {item.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>
            )}
          </div>

          {/* Actions */}
          {!readonly && (
            <div className="flex items-center gap-1 shrink-0">
              {/* Retry for failed automated tests */}
              {!isManual && item.status === 'FAILED' && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <RotateCcw className="w-3 h-3" /> Retry
                </Button>
              )}
              {/* View run link */}
              {item.testCase && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                  <Link href={`/test-cases/${item.testCase.id}`}>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </Button>
              )}
              {/* Delete button for manual checks on hover */}
              {isManual && canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              {/* More menu */}
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.libraryTestCase && (
                      <DropdownMenuItem asChild>
                        <Link href={`/library/test-cases/${item.libraryTestCase.id}`}>
                          <BookOpen className="w-3.5 h-3.5 mr-2" /> View in Library
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Inline Manual Check Input ─────────────────────────────────────────────────

function InlineManualCheckInput({ releaseId }: { releaseId: string }) {
  const addItem = useAddChecklistItem(releaseId);
  const [value, setValue] = useState('');

  async function handleSubmit() {
    const title = value.trim();
    if (!title) return;
    try {
      setValue('');
      await addItem.mutateAsync({ type: 'MANUAL_TEST', title });
      toast.success('Manual check added');
    } catch (err) {
      setValue(title);
      toast.error((err as Error).message ?? 'Failed to add');
    }
  }

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Add manual check... (Enter to create)"
        className="flex-1 h-9 text-sm"
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
        }}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={!value.trim() || addItem.isPending}
        className="h-9 px-3"
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ── Checklist Section ─────────────────────────────────────────────────────────

function ChecklistSection({
  title,
  items,
  type,
  release,
  canManage,
  canCheck,
  onAddFromLibrary,
}: {
  title: string;
  items: ReleaseChecklistItem[];
  type: 'AUTOMATED_TEST' | 'MANUAL_TEST';
  release: ReleaseDetail;
  canManage: boolean;
  canCheck: boolean;
  onAddFromLibrary: () => void;
}) {
  const readonly = ['RELEASED', 'CANCELLED'].includes(release.status);
  const passed = items.filter(i => i.status === 'PASSED' || i.status === 'SKIPPED').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {passed}/{items.length} ready
          </span>
        </div>
        {!readonly && canManage && type === 'AUTOMATED_TEST' && (
          <Button size="sm" variant="outline" onClick={onAddFromLibrary}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add from Library
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {type === 'MANUAL_TEST'
              ? 'No manual checks. Add checklist items to track non-automated gates.'
              : 'No automated tests linked. Add test cases from your Library.'}
          </p>
          {!readonly && canManage && type === 'AUTOMATED_TEST' && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={onAddFromLibrary}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add from Library
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              releaseId={release.id}
              releaseStatus={release.status}
              canManage={canManage}
              canCheck={canCheck}
            />
          ))}
        </div>
      )}

      {/* Inline input at bottom for manual checks */}
      {type === 'MANUAL_TEST' && !readonly && canManage && (
        <InlineManualCheckInput releaseId={release.id} />
      )}
    </div>
  );
}

// ── Main Detail Content ───────────────────────────────────────────────────────

function ReleaseDetailContent({ id }: { id: string }) {
  const { data: release, isLoading } = useRelease(id);
  const { user } = useAuth();
  const router = useRouter();
  const cancelRelease = useCancelRelease(id);
  const deleteRelease = useDeleteRelease();

  const [editOpen, setEditOpen] = useState(false);
  const [markReleasedOpen, setMarkReleasedOpen] = useState(false);
  const [addLibraryOpen, setAddLibraryOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const canManage = user?.role ? CAN_MANAGE.includes(user.role) : false;
  const canCheck = user?.role ? CAN_CHECK.includes(user.role) : false;

  if (isLoading) return <ReleaseDetailSkeleton />;
  if (!release) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Package className="w-12 h-12 text-muted-foreground/40" />
      <p className="text-muted-foreground">Release not found</p>
      <Button variant="outline" asChild><Link href="/releases">Back to Releases</Link></Button>
    </div>
  );

  const items = release.checklistItems ?? [];
  const automatedItems = items.filter(i => i.type === 'AUTOMATED_TEST');
  const manualItems = items.filter(i => i.type === 'MANUAL_TEST');
  const existingLibraryIds = automatedItems.map(i => i.libraryTestCaseId).filter(Boolean) as string[];

  const { total, passed, failed, blocked, pending, inProgress } = computeProgress(items);
  const progressPct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0;
  const blockerCount = failed + blocked + pending + inProgress;
  const readonly = ['RELEASED', 'CANCELLED'].includes(release.status);

  async function handleCancel() {
    try {
      await cancelRelease.mutateAsync();
      toast.success('Release cancelled');
      setCancelConfirmOpen(false);
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to cancel');
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/releases" className="hover:text-foreground transition-colors">Releases</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium truncate">{release.name} {release.version}</span>
      </nav>

      {/* Header */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Left: metadata */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <Package className="w-5 h-5 text-muted-foreground shrink-0" />
                <h1 className="text-xl font-bold leading-tight">
                  {release.name} <span className="text-muted-foreground font-normal">— {release.version}</span>
                </h1>
                <StatusBadge status={release.status} />
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {release.team && (
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {release.team.name}</span>
                )}
                {release.targetDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Target: {fmtDate(release.targetDate)}
                  </span>
                )}
                <span>Created by {release.createdBy?.name ?? 'Unknown'} · {relDate(release.createdAt)}</span>
                {release.releasedAt && (
                  <span className="text-green-600 dark:text-green-400">
                    Released on {fmtDate(release.releasedAt)}
                  </span>
                )}
              </div>
              {release.description && (
                <p className="text-sm text-muted-foreground">{release.description}</p>
              )}
            </div>

            {/* Right: action buttons */}
            {!readonly && canManage && (
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => setMarkReleasedOpen(true)}
                  className={blockerCount > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  {blockerCount > 0 ? `${blockerCount} blocking` : 'Mark Released'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="w-9 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCancelConfirmOpen(true)}>
                      <Ban className="w-3.5 h-3.5 mr-2" /> Cancel Release
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirmOpen(true)}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Release
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Summary bar */}
          {total > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400 font-medium">{passed} passed</span>
                  {failed > 0 && <span className="text-red-500 font-medium">{failed} failed</span>}
                  {blocked > 0 && <span className="text-orange-500 font-medium">{blocked} blocked</span>}
                  {(pending + inProgress) > 0 && <span>{pending + inProgress} not run</span>}
                  <span className="ml-auto font-medium">{progressPct}% ready</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${progressPct}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${failedPct}%` }} />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Checklist sections */}
      <ChecklistSection
        title="Automated Tests"
        items={automatedItems}
        type="AUTOMATED_TEST"
        release={release}
        canManage={canManage}
        canCheck={canCheck}
        onAddFromLibrary={() => setAddLibraryOpen(true)}
      />

      <ChecklistSection
        title="Manual Checks"
        items={manualItems}
        type="MANUAL_TEST"
        release={release}
        canManage={canManage}
        canCheck={canCheck}
        onAddFromLibrary={() => setAddLibraryOpen(true)}
      />

      {/* Dialogs */}
      <EditReleaseDialog release={release} open={editOpen} onClose={() => setEditOpen(false)} />
      <MarkReleasedDialog release={release} open={markReleasedOpen} onClose={() => setMarkReleasedOpen(false)} />
      <AddFromLibraryDialog
        releaseId={id}
        existingLibraryIds={existingLibraryIds}
        open={addLibraryOpen}
        onClose={() => setAddLibraryOpen(false)}
      />

      {/* Cancel confirm */}
      <Dialog open={cancelConfirmOpen} onOpenChange={o => !o && setCancelConfirmOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cancel Release?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will mark the release as cancelled. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Keep Release</Button>
            <Button
              onClick={handleCancel}
              disabled={cancelRelease.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {cancelRelease.isPending ? 'Cancelling...' : 'Cancel Release'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={o => !o && setDeleteConfirmOpen(false)}
        title="Delete Release?"
        description="This will permanently delete this release and all its checklist items."
        variant="danger"
        confirmText="Delete"
        onConfirm={async () => {
          await deleteRelease.mutateAsync(id);
          toast.success('Release deleted');
          router.push('/releases');
        }}
      />
    </div>
  );
}

export default function ReleaseDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <Suspense fallback={<ReleaseDetailSkeleton />}>
      <ReleaseDetailContent id={id} />
    </Suspense>
  );
}
