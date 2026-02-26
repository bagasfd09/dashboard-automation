'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UserPlus,
  MoreHorizontal,
  Search,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  LogOut,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { Pagination } from '@/components/Pagination';
import type { UserRecord, UserRole, TeamSummary } from '@/lib/types';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'];

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  SUPERVISOR: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  TEAM_LEAD: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  MEMBER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  MONITORING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
};

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  teams,
}: {
  onClose: () => void;
  teams: TeamSummary[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('MEMBER');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');

  const perms = user?.permissions;
  const allowedRoles = perms ? ROLES.filter((r) => perms.canInviteRoles.includes(r)) : ROLES;

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email, role, teamIds: selectedTeams }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setInviteLink(data.inviteLink);
      toast.success('Invite created');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to invite'),
  });

  function toggleTeam(id: string) {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => toast.success('Link copied!'));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Invite user</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {inviteLink ? (
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Share this link with the invited user:</p>
            <div className="flex items-center gap-2 bg-muted rounded-md p-3">
              <p className="text-xs font-mono flex-1 truncate">{inviteLink}</p>
              <button onClick={copyLink} className="p-1.5 hover:bg-background rounded">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}
            className="p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Teams (optional)</label>
              <div className="border border-border rounded-md divide-y divide-border max-h-36 overflow-y-auto">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTeams.includes(t.id)}
                      onChange={() => toggleTeam(t.id)}
                      className="rounded"
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={invite.isPending}
                className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {invite.isPending ? 'Sending...' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
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
  const qc = useQueryClient();
  const [name, setName] = useState(target.name);
  const [role, setRole] = useState<UserRole>(target.role);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(target.teams.map((t) => t.id));

  const isAdmin = currentUser?.role === 'ADMIN';

  const update = useMutation({
    mutationFn: () =>
      api.updateUser(target.id, {
        name,
        ...(isAdmin ? { role, teamIds: selectedTeams } : {}),
      }),
    onSuccess: () => {
      toast.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  });

  function toggleTeam(id: string) {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold">Edit user</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {isAdmin && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Teams</label>
                <div className="border border-border rounded-md divide-y divide-border max-h-36 overflow-y-auto">
                  {teams.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTeams.includes(t.id)}
                        onChange={() => toggleTeam(t.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-md px-4 py-2 text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="flex-1 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {update.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row actions dropdown ──────────────────────────────────────────────────────

function RowActions({
  user: target,
  onEdit,
}: {
  user: UserRecord;
  onEdit: () => void;
}) {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resetLink, setResetLink] = useState('');

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
      setResetLink(data.resetLink);
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

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
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
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => { setOpen(false); toggleActive.mutate(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {target.isActive ? (
                <><XCircle className="w-4 h-4 text-amber-500" /> Deactivate</>
              ) : (
                <><CheckCircle className="w-4 h-4 text-green-500" /> Activate</>
              )}
            </button>
            <button
              onClick={() => { setOpen(false); resetPw.mutate(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset password
            </button>
            {isAdmin && (
              <button
                onClick={() => { setOpen(false); forceLogout.mutate(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Force logout
              </button>
            )}
            {isAdmin && (
              <>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => {
                    setOpen(false);
                    if (confirm(`Delete ${target.name}? This cannot be undone.`)) deleteUser.mutate();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);

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
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
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
            className="pl-9 border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-56"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
              </tr>
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
        <InviteModal
          onClose={() => setShowInvite(false)}
          teams={teams ?? []}
        />
      )}

      {editing && (
        <EditModal
          user={editing}
          teams={teams ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
