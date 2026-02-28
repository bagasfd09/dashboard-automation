'use client';

import { Suspense, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  Server,
  GitBranch,
  Package2,
  ChevronRight,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { useTeams } from '@/hooks/use-teams';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SmartButton } from '@/components/ui/smart-button';
import { ValidatedInput } from '@/components/ui/validated-input';
import { ValidatedTextarea } from '@/components/ui/validated-textarea';
import { FormField } from '@/components/ui/form-field';
import { TagInput } from '@/components/ui/tag-input';
import { cn } from '@/lib/utils';
import type { Application } from '@/lib/types';
import type { ValidationResult } from '@/components/ui/validated-input';

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#6b7280', // gray
];

function toSlug(val: string) {
  return val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function err(msg: string): ValidationResult { return { state: 'error', message: msg }; }

// ── App Card ──────────────────────────────────────────────────────────────────

function AppCard({
  app,
  onEdit,
  onDelete,
  canManage,
}: {
  app: Application;
  onEdit: (app: Application) => void;
  onDelete: (app: Application) => void;
  canManage: boolean;
}) {
  const color = app.color ?? '#6b7280';

  return (
    <div className="relative rounded-xl border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white text-xl font-bold"
          style={{ backgroundColor: color }}
        >
          {app.icon || app.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{app.name}</h3>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {app.slug}
            </span>
            {!app.isActive && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border">
                Inactive
              </span>
            )}
          </div>

          {app.description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{app.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              {app._count?.testRuns ?? 0} runs
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {app._count?.testCases ?? 0} test cases
            </span>
            <span className="flex items-center gap-1">
              <Package2 className="h-3 w-3" />
              {app._count?.releases ?? 0} releases
            </span>
          </div>

          {app.environments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {app.environments.map((env) => (
                <span
                  key={env}
                  className="text-xs bg-muted border rounded-full px-2 py-0.5 text-muted-foreground"
                >
                  {env}
                </span>
              ))}
            </div>
          )}

          {app.team && (
            <p className="mt-2 text-xs text-muted-foreground">
              Team: <span className="font-medium">{app.team.name}</span>
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => onEdit(app)}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(app)}
              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

function AppModal({
  app,
  onClose,
  onSaved,
}: {
  app: Application | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: teams } = useTeams();

  const isEdit = app !== null;

  const [name, setName] = useState(app?.name ?? '');
  const [slug, setSlug] = useState(app?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(app?.description ?? '');
  const [icon, setIcon] = useState(app?.icon ?? '');
  const [color, setColor] = useState(app?.color ?? APP_COLORS[0]);
  const [environments, setEnvironments] = useState<string[]>(
    app?.environments ?? ['development', 'staging', 'production'],
  );
  const [teamId, setTeamId] = useState(app?.teamId ?? (teams?.[0]?.id ?? ''));
  const [isActive, setIsActive] = useState(app?.isActive ?? true);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugTouched) setSlug(toSlug(val));
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.updateApplication(app!.id, {
            name,
            description: description || undefined,
            icon: icon || undefined,
            color,
            environments,
            isActive,
          })
        : api.createApplication({
            name,
            slug: slug || toSlug(name),
            description: description || undefined,
            icon: icon || undefined,
            color,
            environments,
            teamId,
          }),
    onSuccess: () => {
      toast.success(isEdit ? 'Application updated' : 'Application created');
      onSaved();
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to save application');
    },
  });

  const canSave = name.trim().length > 0 && (isEdit || !!teamId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-background shadow-2xl border">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Application' : 'New Application'}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <FormField label="Name" required>
            <ValidatedInput
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. NexChief"
              validate={(v) => (!v.trim() ? err('Name is required') : null)}
            />
          </FormField>

          {!isEdit && (
            <FormField label="Slug" hint="Unique identifier used by the SDK reporter">
              <ValidatedInput
                value={slug}
                onChange={(v) => { setSlug(toSlug(v)); setSlugTouched(true); }}
                placeholder="e.g. nexchief"
                validate={(v) => {
                  if (!v.trim()) return err('Slug is required');
                  if (!/^[a-z0-9-]+$/.test(v)) return err('Only lowercase letters, numbers and hyphens');
                  return null;
                }}
              />
            </FormField>
          )}

          {!isEdit && (
            <FormField label="Team">
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {teams?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label="Description">
            <ValidatedTextarea
              value={description}
              onChange={setDescription}
              placeholder="Brief description of this application..."
              rows={2}
            />
          </FormField>

          <FormField label="Icon" hint="Single emoji or short text displayed on the card">
            <ValidatedInput
              value={icon}
              onChange={setIcon}
              placeholder="e.g. 🚀"
            />
          </FormField>

          <FormField label="Color">
            <div className="flex flex-wrap gap-2">
              {APP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </FormField>

          <FormField label="Environments" hint="Press Enter to add (e.g. development, staging, production)">
            <TagInput
              value={environments}
              onChange={setEnvironments}
              placeholder="Add environment..."
            />
          </FormField>

          {isEdit && (
            <FormField label="Status">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded"
                />
                Active
              </label>
            </FormField>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <SmartButton
            onClick={async () => { mutation.mutate(); }}
            loading={mutation.isPending}
            disabled={!canSave}
          >
            {isEdit ? 'Save Changes' : 'Create Application'}
          </SmartButton>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ApplicationsContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modalApp, setModalApp] = useState<Application | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.getApplications(),
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteApplication(id),
    onSuccess: () => {
      toast.success('Application deleted');
      qc.invalidateQueries({ queryKey: ['applications'] });
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to delete');
    },
  });

  const canManage = ['ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(user?.role ?? '');

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['applications'] });
    setModalApp(null);
  }

  function openDelete(app: Application) {
    setDeleteTarget(app);
    setDeleteOpen(true);
  }

  // Group apps by team
  const byTeam = apps.reduce<Record<string, { teamName: string; apps: Application[] }>>((acc, app) => {
    const key = app.teamId;
    if (!acc[key]) acc[key] = { teamName: app.team?.name ?? app.teamId, apps: [] };
    acc[key].apps.push(app);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage applications and their environments for multi-app monitoring
          </p>
        </div>
        {canManage && (
          <SmartButton onClick={async () => setModalApp('new')} icon={<Plus className="h-4 w-4" />}>
            New Application
          </SmartButton>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && apps.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">No applications yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Register your first application to start scoping runs, test cases, and releases by app.
          </p>
          {canManage && (
            <SmartButton className="mt-4" onClick={async () => setModalApp('new')} icon={<Plus className="h-4 w-4" />}>
              New Application
            </SmartButton>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
              <div className="flex gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apps grouped by team */}
      {!isLoading && Object.entries(byTeam).map(([, { teamName, apps: teamApps }]) => (
        <div key={teamName}>
          <div className="flex items-center gap-2 mb-3">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {teamName}
            </span>
            <span className="text-xs text-muted-foreground">
              ({teamApps.length} app{teamApps.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teamApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                onEdit={(a) => setModalApp(a)}
                onDelete={openDelete}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Create / Edit modal */}
      {modalApp !== null && (
        <AppModal
          app={modalApp === 'new' ? null : modalApp}
          onClose={() => setModalApp(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteTarget(null); }}
        title="Delete Application"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will not delete the runs or test cases associated with it.`}
        variant="danger"
        confirmText="Delete"
        onConfirm={async () => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsContent />
    </Suspense>
  );
}
