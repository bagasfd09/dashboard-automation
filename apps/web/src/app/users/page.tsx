'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus, MoreHorizontal, Search, CheckCircle, XCircle, Pencil, Trash2, LogOut, RefreshCw,
  User, Users, Eye, Shield, Briefcase, Crown, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/Pagination';
import { cn } from '@/lib/utils';
import type { UserRecord, UserRole, TeamSummary } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'];

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  MANAGER:    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  SUPERVISOR: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  TEAM_LEAD:  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  MEMBER:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MONITORING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
};

// ── Role card definitions ─────────────────────────────────────────────────────

const PRIMARY_ROLE_CARDS = [
  { role: 'MEMBER'    as UserRole, icon: User,     label: 'Member',     desc: 'Runs tests & reports' },
  { role: 'TEAM_LEAD' as UserRole, icon: Users,    label: 'Team Lead',  desc: 'Manages library & releases' },
  { role: 'MONITORING'as UserRole, icon: Eye,      label: 'Monitoring', desc: 'Views reports only' },
];
const MORE_ROLE_CARDS = [
  { role: 'SUPERVISOR'as UserRole, icon: Shield,   label: 'Supervisor', desc: 'Views across teams' },
  { role: 'MANAGER'   as UserRole, icon: Briefcase,label: 'Manager',    desc: 'Manages teams & API keys' },
  { role: 'ADMIN'     as UserRole, icon: Crown,    label: 'Admin',      desc: 'Full system access' },
];

// Role permissions for impact preview
const ROLE_PERMS: Record<UserRole, string[]> = {
  MONITORING: ['View reports and dashboards'],
  MEMBER:     ['Run tests', 'View test results', 'View reports'],
  TEAM_LEAD:  ['Run tests', 'View test results', 'Manage library test cases', 'Create and approve releases', 'Invite team members', 'View reports'],
  SUPERVISOR: ['Run tests', 'View test results', 'View across teams', 'View activity log', 'View reports'],
  MANAGER:    ['Run tests', 'View test results', 'Manage teams', 'Manage API keys', 'View all teams', 'View reports'],
  ADMIN:      ['Full system access', 'Manage users', 'Force logout sessions', 'Delete users', 'Manage teams', 'Manage API keys'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function computeRoleImpact(from: UserRole, to: UserRole) {
  const fromSet = new Set(ROLE_PERMS[from]);
  const toSet   = new Set(ROLE_PERMS[to]);
  return {
    gains:  Array.from(toSet).filter((p) => !fromSet.has(p)),
    losses: Array.from(fromSet).filter((p) => !toSet.has(p)),
  };
}

// ── Role cards component ──────────────────────────────────────────────────────

function RoleCards({
  selected,
  onSelect,
  allowedRoles,
}: {
  selected: UserRole;
  onSelect: (r: UserRole) => void;
  allowedRoles: UserRole[];
}) {
  const [showMore, setShowMore] = useState(false);

  const visiblePrimary = PRIMARY_ROLE_CARDS.filter((c) => allowedRoles.includes(c.role));
  const visibleMore    = MORE_ROLE_CARDS.filter((c) => allowedRoles.includes(c.role));

  function RoleCard({ role, icon: Icon, label, desc }: { role: UserRole; icon: React.ElementType; label: string; desc: string }) {
    const active = selected === role;
    return (
      <button
        type="button"
        onClick={() => onSelect(role)}
        className={cn(
          'flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all',
          active
            ? 'border-primary bg-primary/5 dark:bg-primary/10'
            : 'border-border hover:border-primary/40 hover:bg-muted/40',
        )}
      >
        <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
        <p className={cn('text-sm font-medium', active ? 'text-primary' : '')}>{label}</p>
        <p className="text-xs text-muted-foreground leading-snug">{desc}</p>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {visiblePrimary.map((c) => <RoleCard key={c.role} {...c} />)}
      </div>

      {visibleMore.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full pt-1"
          >
            <span className="flex-1 h-px bg-border" />
            More roles
            {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span className="flex-1 h-px bg-border" />
          </button>

          {showMore && (
            <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-top-1 duration-150">
              {visibleMore.map((c) => <RoleCard key={c.role} {...c} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Email chip input ──────────────────────────────────────────────────────────

type EmailChip = { email: string; status: 'valid' | 'invalid-format' | 'pending' };

function EmailChipInput({
  chips,
  onChange,
  autoFocus,
}: {
  chips: EmailChip[];
  onChange: (chips: EmailChip[]) => void;
  autoFocus?: boolean;
}) {
  const [input, setInput]   = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 50);
  }, [autoFocus]);

  function addEmail(raw: string) {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (chips.some((c) => c.email === email)) { setInput(''); return; }
    const status: EmailChip['status'] = EMAIL_RE.test(email) ? 'valid' : 'invalid-format';
    onChange([...chips, { email, status }]);
    setInput('');
  }

  function removeChip(email: string) {
    onChange(chips.filter((c) => c.email !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addEmail(input);
    } else if (e.key === 'Backspace' && !input && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        'flex flex-wrap items-center gap-1.5 p-2.5 min-h-[44px] rounded-lg border border-input bg-background cursor-text transition-colors',
        focused && 'ring-2 ring-ring border-ring',
      )}
    >
      {chips.map((chip) => (
        <span
          key={chip.email}
          title={chip.status === 'invalid-format' ? 'Invalid email format' : undefined}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            chip.status === 'valid'
              ? 'bg-primary/10 text-primary'
              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border border-red-300 dark:border-red-800',
          )}
        >
          {chip.email}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeChip(chip.email); }}
            className="hover:opacity-70 transition-opacity"
            aria-label={`Remove ${chip.email}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (input.trim()) addEmail(input); }}
        placeholder={chips.length === 0 ? 'email@company.com' : ''}
        className="flex-1 min-w-[140px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, teams }: { onClose: () => void; teams: TeamSummary[] }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [chips, setChips]         = useState<EmailChip[]>([]);
  const [role, setRole]           = useState<UserRole>('MEMBER');
  const [selectedTeam, setSelectedTeam] = useState<string>(
    user?.role === 'TEAM_LEAD' && user.teams.length > 0 ? user.teams[0].id : '',
  );

  const perms        = user?.permissions;
  const allowedRoles: UserRole[] = perms ? ROLES.filter((r) => perms.canInviteRoles.includes(r)) : ROLES;
  const isTeamLead   = user?.role === 'TEAM_LEAD';

  const selectedTeamName = teams.find((t) => t.id === selectedTeam)?.name ?? '';
  const validChips       = chips.filter((c) => c.status === 'valid');
  const invalidChips     = chips.filter((c) => c.status !== 'valid');
  const canSubmit        = validChips.length > 0 && !invalidChips.length && role;

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        validChips.map((c) =>
          api.inviteUser({ email: c.email, role, teamIds: selectedTeam ? [selectedTeam] : [] })
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed    = results.length - succeeded;
      qc.invalidateQueries({ queryKey: ['users'] });
      if (failed === 0) {
        toast.success(`${succeeded} invitation${succeeded !== 1 ? 's' : ''} sent ✅`);
      } else {
        toast.warning(`${succeeded} of ${results.length} invitations sent. ${failed} failed.`);
      }
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to invite'),
  });

  const roleLabel = PRIMARY_ROLE_CARDS.find((c) => c.role === role)?.label
    ?? MORE_ROLE_CARDS.find((c) => c.role === role)?.label
    ?? role;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[520px] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="invite-modal-title" className="font-semibold">Invite team member</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Email input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Who are you inviting?</label>
            <EmailChipInput chips={chips} onChange={setChips} autoFocus />
            <p className="text-xs text-muted-foreground">
              💡 Press Enter after each email. They'll receive login credentials.
            </p>
            {invalidChips.length > 0 && (
              <p className="text-xs text-red-500">
                {invalidChips.length} invalid email{invalidChips.length !== 1 ? 's' : ''} — fix or remove before sending.
              </p>
            )}
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">What's their role?</label>
            <RoleCards selected={role} onSelect={setRole} allowedRoles={allowedRoles} />
          </div>

          {/* Team selection */}
          {!isTeamLead && teams.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Which team?</label>
              <div className="space-y-1">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="team"
                      value={t.id}
                      checked={selectedTeam === t.id}
                      onChange={() => setSelectedTeam(t.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {isTeamLead && selectedTeamName && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Team</label>
              <p className="text-sm text-muted-foreground">{selectedTeamName}</p>
            </div>
          )}

          {/* Summary */}
          {validChips.length > 0 && (
            <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
              💡 Inviting <strong>{validChips.length} {validChips.length === 1 ? 'person' : 'people'}</strong> as <strong>{roleLabel}</strong>
              {selectedTeamName ? <> to <strong>{selectedTeamName}</strong></> : ''}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <SmartButton
            onClick={async () => { await inviteMutation.mutateAsync(); }}
            loadingText="Sending..."
            successText="✅ Invited!"
            disabled={!canSubmit}
          >
            Send Invite →
          </SmartButton>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  user: target,
  teams,
  onClose,
}: {
  user: UserRecord;
  teams: TeamSummary[];
  onClose: () => void;
}) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [role, setRole]           = useState<UserRole>(target.role);
  const [selectedTeam, setSelectedTeam] = useState<string>(target.teams[0]?.id ?? '');
  const [confirmDemotion, setConfirmDemotion] = useState(false);

  const isAdmin   = currentUser?.role === 'ADMIN';
  const isManager = currentUser?.role === 'MANAGER';
  const canChangeTeam = isAdmin || isManager;

  const allowedRoles: UserRole[] = isAdmin
    ? ROLES
    : isManager
    ? ROLES.filter((r) => r !== 'ADMIN')
    : [target.role];

  const impact = role !== target.role ? computeRoleImpact(target.role, role) : null;
  const isDemotion = role !== target.role && (
    ROLES.indexOf(role) < ROLES.indexOf(target.role)
  );

  const selectedTeamName = teams.find((t) => t.id === selectedTeam)?.name ?? target.teams[0]?.name ?? '';

  const update = useMutation({
    mutationFn: () =>
      api.updateUser(target.id, {
        ...(isAdmin || isManager ? { role } : {}),
        ...(canChangeTeam ? { teamIds: selectedTeam ? [selectedTeam] : [] } : {}),
      }),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  });

  async function handleSave() {
    if (isDemotion && impact && impact.losses.length > 0) {
      setConfirmDemotion(true);
      return;
    }
    await update.mutateAsync();
  }

  const initials = (() => {
    const parts = target.name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : target.name.slice(0, 2).toUpperCase();
  })();

  const newRoleLabel = PRIMARY_ROLE_CARDS.find((c) => c.role === role)?.label
    ?? MORE_ROLE_CARDS.find((c) => c.role === role)?.label
    ?? role;
  const oldRoleLabel = PRIMARY_ROLE_CARDS.find((c) => c.role === target.role)?.label
    ?? MORE_ROLE_CARDS.find((c) => c.role === target.role)?.label
    ?? target.role;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[540px] animate-in zoom-in-95 duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 id="edit-modal-title" className="font-semibold">Edit Member</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{initials}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">{target.name}</p>
                <p className="text-xs text-muted-foreground">{target.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current: <span className={cn('font-medium text-xs px-1.5 py-0.5 rounded-full', ROLE_COLORS[target.role])}>
                    {oldRoleLabel}
                  </span>
                  {target.teams.length > 0 && ` • ${target.teams.map((t) => t.name).join(', ')}`}
                </p>
              </div>
            </div>

            {/* Role selection */}
            {(isAdmin || isManager) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Change role:</label>
                <RoleCards selected={role} onSelect={setRole} allowedRoles={allowedRoles} />
              </div>
            )}

            {/* Team selection */}
            {canChangeTeam && teams.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Change team:</label>
                <div className="space-y-1">
                  {teams.map((t) => (
                    <label key={t.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                      <input
                        type="radio"
                        name="edit-team"
                        value={t.id}
                        checked={selectedTeam === t.id}
                        onChange={() => setSelectedTeam(t.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm">
                        {t.name}
                        {target.teams.some((ut) => ut.id === t.id) && (
                          <span className="ml-1.5 text-xs text-muted-foreground">(current)</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                {selectedTeam && !target.teams.some((t) => t.id === selectedTeam) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ User will lose access to their current team's data.
                  </p>
                )}
              </div>
            )}

            {/* Impact preview */}
            {impact && (impact.gains.length > 0 || impact.losses.length > 0) && (
              <div className={cn(
                'rounded-xl p-4 space-y-2 border',
                isDemotion
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                  : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50',
              )}>
                <p className={cn(
                  'text-xs font-semibold',
                  isDemotion ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400',
                )}>
                  ⚠️ Impact: {oldRoleLabel} → {newRoleLabel}
                </p>
                <div className="space-y-1">
                  {impact.gains.map((g) => (
                    <p key={g} className="text-xs text-green-700 dark:text-green-400 flex items-start gap-1.5">
                      <span className="shrink-0">✅</span> Can now {g.toLowerCase()}
                    </p>
                  ))}
                  {impact.losses.map((l) => (
                    <p key={l} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                      <span className="shrink-0">❌</span> Can no longer {l.toLowerCase()}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <SmartButton
              onClick={async () => handleSave()}
              loadingText="Saving..."
              successText="✅ Saved!"
              disabled={update.isPending}
            >
              Save Changes
            </SmartButton>
          </div>
        </div>
      </div>

      {/* Demotion confirmation */}
      <ConfirmDialog
        open={confirmDemotion}
        onOpenChange={setConfirmDemotion}
        variant="warning"
        title={`Demote ${target.name} from ${oldRoleLabel} to ${newRoleLabel}?`}
        description={
          <span>
            They will lose access to:{' '}
            <strong>{computeRoleImpact(target.role, role).losses.join(', ')}</strong>.
          </span>
        }
        confirmText="Confirm Demotion"
        onConfirm={async () => { await update.mutateAsync(); }}
      />
    </>
  );
}

// ── Row actions dropdown ──────────────────────────────────────────────────────

function RowActions({ user: target, onEdit }: { user: UserRecord; onEdit: () => void }) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  const toggleActive = useMutation({
    mutationFn: () => api.toggleUserActive(target.id, !target.isActive),
    onSuccess: () => {
      toast.success(`User ${target.isActive ? 'deactivated' : 'activated'}`);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const forceLogout = useMutation({
    mutationFn: () => api.forceLogout(target.id),
    onSuccess: () => toast.success('User sessions revoked'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const resetPw = useMutation({
    mutationFn: () => api.resetUserPassword(target.id),
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.resetLink).then(() =>
        toast.success('Reset link copied to clipboard')
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  const deleteUser = useMutation({
    mutationFn: () => api.deleteUser(target.id),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="p-1.5 hover:bg-muted rounded transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 w-48">
              <button onClick={() => { setOpen(false); onEdit(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button onClick={() => { setOpen(false); toggleActive.mutate(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                {target.isActive
                  ? <><XCircle className="w-4 h-4 text-amber-500" /> Deactivate</>
                  : <><CheckCircle className="w-4 h-4 text-green-500" /> Activate</>}
              </button>
              <button onClick={() => { setOpen(false); resetPw.mutate(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                <RefreshCw className="w-4 h-4" /> Reset password
              </button>
              {isAdmin && (
                <button onClick={() => { setOpen(false); forceLogout.mutate(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors">
                  <LogOut className="w-4 h-4" /> Force logout
                </button>
              )}
              {isAdmin && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => { setOpen(false); setDeleteConfirm(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        variant="danger"
        title={`Delete ${target.name}?`}
        description="This cannot be undone. All data associated with this user will be permanently removed."
        confirmText="Delete"
        onConfirm={async () => { await deleteUser.mutateAsync(); }}
      />
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage]          = useState(1);
  const [search, setSearch]      = useState('');
  const [roleFilter, setRoleFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing]    = useState<UserRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter, statusFilter],
    queryFn: () =>
      api.getUsers({
        search: search || undefined,
        role: (roleFilter as UserRole) || undefined,
        isActive: statusFilter || undefined,
        page,
        pageSize: 20,
      }),
  });

  const { data: teams } = useQuery<TeamSummary[]>({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(),
  });

  const canInvite = (currentUser?.permissions?.canInviteRoles.length ?? 0) > 0;

  function formatLastLogin(d: string | null) {
    if (!d) return 'Never';
    return new Date(d).toLocaleDateString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        {canInvite && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite user
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring w-56"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Teams</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : data?.data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
            ) : (
              data?.data.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {u.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <XCircle className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.teams.length > 0 ? u.teams.map((t) => t.name).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatLastLogin(u.lastLoginAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {currentUser?.id !== u.id && (
                      <RowActions user={u} onEdit={() => setEditing(u)} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.totalPages > 1 && (
        <Pagination
          currentPage={data.pagination.page}
          totalPages={data.pagination.totalPages}
          totalItems={data.pagination.totalItems}
          pageSize={data.pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} teams={teams ?? []} />
      )}

      {editing && (
        <EditModal user={editing} teams={teams ?? []} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
