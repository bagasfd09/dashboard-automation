'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Monitor, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { Session } from '@/lib/types';

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState(user?.name ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.getSessions(),
  });

  const updateName = useMutation({
    mutationFn: () => api.updateMe(name),
    onSuccess: async () => {
      toast.success('Name updated');
      await refreshUser();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to update'),
  });

  const changePw = useMutation({
    mutationFn: () => api.changePassword(currentPw, newPw),
    onSuccess: () => {
      toast.success('Password changed');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to change password'),
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked');
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to revoke'),
  });

  function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    changePw.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Name */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Personal info</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              value={user?.email ?? ''}
              disabled
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <input
              value={user?.role ?? ''}
              disabled
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground"
            />
          </div>
        </div>
        <button
          onClick={() => updateName.mutate()}
          disabled={updateName.isPending || !name.trim() || name === user?.name}
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {updateName.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </section>

      {/* Change password */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={handleChangePw} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5">Current password</label>
            <input
              type="password"
              required
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={changePw.isPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {changePw.isPending ? 'Saving...' : 'Change password'}
          </button>
        </form>
      </section>

      {/* Sessions */}
      <section className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Active sessions</h2>
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            {sessions?.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      {s.deviceInfo ?? 'Unknown device'}
                      {s.current && (
                        <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Created {formatDate(s.createdAt)}</p>
                  </div>
                </div>
                {!s.current && (
                  <button
                    onClick={() => revokeSession.mutate(s.id)}
                    disabled={revokeSession.isPending}
                    className="p-1.5 hover:bg-destructive/10 rounded text-destructive transition-colors"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
