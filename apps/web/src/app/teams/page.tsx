'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { useTeams } from '@/hooks/use-teams';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamsSkeleton } from '@/components/skeletons';
import { teamColorClass } from '@/lib/team-colors';
import { cn } from '@/lib/utils';
import type { TeamSummary, RunStatus } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 86_400_000)   return 'Today';
  if (diff < 2 * 86_400_000) return 'Yesterday';
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / (7 * 86_400_000))} weeks ago`;
  return d.toLocaleDateString();
}

// ── Inline team name editor ───────────────────────────────────────────────────

function TeamNameInput({
  initialValue = '',
  placeholder = 'Team name',
  onSave,
  onCancel,
  existingNames,
  autoFocus = true,
}: {
  initialValue?: string;
  placeholder?: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
  existingNames: string[];
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) { setError('Name is required'); return; }
    if (trimmed.length < 2) { setError('Name must be at least 2 characters'); return; }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initialValue)) {
      setError('Team name already exists');
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={saving}
          className={cn(
            'flex-1 text-sm bg-background border rounded-md px-2.5 py-1.5 outline-none transition-colors',
            'focus:ring-2 focus:ring-ring focus:border-ring',
            error ? 'border-red-400 focus:ring-red-400/20' : 'border-input',
            saving && 'opacity-60',
          )}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-50"
          aria-label="Save"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── New team inline card ──────────────────────────────────────────────────────

function NewTeamCard({
  onSave,
  onCancel,
  existingNames,
}: {
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
  existingNames: string[];
}) {
  return (
    <div className="bg-card border-2 border-dashed border-primary/40 rounded-xl p-4 space-y-3">
      <TeamNameInput
        placeholder="Team name"
        onSave={onSave}
        onCancel={onCancel}
        existingNames={existingNames}
        autoFocus
      />
      <p className="text-xs text-muted-foreground">Press Enter to create, Esc to cancel</p>
    </div>
  );
}

// ── Team card ─────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  canManage,
  existingNames,
  onDelete,
}: {
  team: TeamSummary;
  canManage: boolean;
  existingNames: string[];
  onDelete: (team: TeamSummary) => void;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const updateTeam = useMutation({
    mutationFn: (name: string) => api.updateTeam(team.id, name),
    onSuccess: () => {
      toast.success('Team updated ✅');
      qc.invalidateQueries({ queryKey: ['teams'] });
      setEditing(false);
    },
  });

  function handleCardClick(e: React.MouseEvent) {
    if (editing) return;
    router.push(`/teams/${team.id}`);
  }

  const colorClass = teamColorClass(team.id);

  return (
    <div
      className={cn(
        'relative bg-card border border-border rounded-xl p-4 transition-all duration-150 group',
        !editing && 'hover:border-primary/40 hover:shadow-md cursor-pointer',
      )}
      onClick={handleCardClick}
    >
      {/* Team name / edit */}
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          <TeamNameInput
            initialValue={team.name}
            onSave={async (name) => { await updateTeam.mutateAsync(name); }}
            onCancel={() => setEditing(false)}
            existingNames={existingNames.filter((n) => n !== team.name)}
            autoFocus
          />
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-lg border text-sm font-semibold',
              colorClass,
            )}
          >
            {team.name}
          </span>

          {/* Context menu */}
          {canManage && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                aria-label="Team actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 w-36">
                    <button
                      onClick={() => { setMenuOpen(false); setEditing(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(team); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {!editing && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{team.totalTestCases} test cases</span>
            {team.totalRuns > 0 && (
              <span
                className={cn(
                  'font-medium',
                  team.passRate >= 80 ? 'text-green-600 dark:text-green-400' :
                  team.passRate >= 50 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                )}
              >
                {team.passRate}% pass
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {team.lastRunAt ? `Updated ${formatDate(team.lastRunAt)}` : `Created ${formatDate(team.createdAt)}`}
            </span>
            {team.lastRunStatus && (
              <StatusBadge status={team.lastRunStatus as RunStatus} type="run" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Teams page content ────────────────────────────────────────────────────────

function TeamsPageContent() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: teams, isLoading } = useTeams();

  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamSummary | null>(null);

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const existingNames = (teams ?? []).map((t) => t.name);

  const createTeam = useMutation({
    mutationFn: (name: string) => api.createTeam(name),
    onSuccess: () => {
      toast.success('Team created ✅');
      qc.invalidateQueries({ queryKey: ['teams'] });
      setCreating(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to create team'),
  });

  const deleteTeam = useMutation({
    mutationFn: (id: string) => api.deleteTeam(id),
    onSuccess: () => {
      toast.success('Team deleted');
      qc.invalidateQueries({ queryKey: ['teams'] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete team'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {teams ? `${teams.length} team${teams.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        {canManage && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Team
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))
          : teams?.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                canManage={canManage}
                existingNames={existingNames}
                onDelete={setDeleteTarget}
              />
            ))}

        {/* Inline create card */}
        {creating && (
          <NewTeamCard
            onSave={async (name) => { await createTeam.mutateAsync(name); }}
            onCancel={() => setCreating(false)}
            existingNames={existingNames}
          />
        )}

        {/* Empty state */}
        {!isLoading && !creating && teams?.length === 0 && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <p className="font-medium">No teams yet</p>
            <p className="text-xs mt-1">Teams are created automatically when the reporter runs for the first time.</p>
            {canManage && (
              <button
                onClick={() => setCreating(true)}
                className="mt-4 text-sm text-primary hover:underline"
              >
                + Create a team manually
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        variant="danger"
        title={`Delete "${deleteTarget?.name}"?`}
        description="This will permanently remove the team and all associated data. This cannot be undone."
        confirmText="Delete"
        confirmInput={deleteTarget ? { label: 'Team name', expectedValue: deleteTarget.name } : undefined}
        onConfirm={async () => {
          if (deleteTarget) await deleteTeam.mutateAsync(deleteTarget.id);
        }}
      />
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<TeamsSkeleton />}>
      <TeamsPageContent />
    </Suspense>
  );
}
