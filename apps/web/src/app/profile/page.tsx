'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Eye, EyeOff, Camera, ChevronDown, ChevronUp, Monitor, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { InlineEdit } from '@/components/ui/inline-edit';
import { SmartButton } from '@/components/ui/smart-button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Session } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getPasswordStrength(pw: string): { level: StrengthLevel; label: string; colorClass: string } {
  if (!pw) return { level: 0, label: '', colorClass: '' };
  if (pw.length < 8) return { level: 1, label: 'Too short', colorClass: 'bg-red-500' };
  const hasLetters = /[a-zA-Z]/.test(pw);
  const hasNumbers = /[0-9]/.test(pw);
  const hasSymbols = /[^a-zA-Z0-9]/.test(pw);
  const isLong = pw.length >= 12;
  if (hasLetters && hasNumbers && hasSymbols && isLong)
    return { level: 4, label: 'Strong', colorClass: 'bg-green-500' };
  if (hasLetters && hasNumbers && hasSymbols)
    return { level: 3, label: 'Medium — add more length', colorClass: 'bg-yellow-500' };
  if (hasLetters && hasNumbers)
    return { level: 2, label: 'Medium — add a symbol', colorClass: 'bg-yellow-500' };
  return { level: 1, label: 'Weak — add numbers or symbols', colorClass: 'bg-orange-500' };
}

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}

// ── Lock field ────────────────────────────────────────────────────────────────

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="flex-1 text-sm text-muted-foreground">{value || '—'}</span>
      <span title="Contact an admin to change this">
        <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
      </span>
    </div>
  );
}

// ── Password strength bar ─────────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const { level, label, colorClass } = getPasswordStrength(password);
  if (!password) return null;
  const bars = [1, 2, 3, 4] as StrengthLevel[];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {bars.map((b) => (
          <div
            key={b}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              b <= level ? colorClass : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className={cn(
        'text-xs',
        level <= 1 ? 'text-red-500' :
        level === 2 ? 'text-orange-500' :
        level === 3 ? 'text-yellow-600 dark:text-yellow-400' :
        'text-green-600 dark:text-green-400',
      )}>
        {label}
      </p>
    </div>
  );
}

// ── Password eye-toggle input ─────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        className="w-full border border-border rounded-md px-3 py-2.5 pr-10 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Profile page ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [currentPwError, setCurrentPwError] = useState('');

  const { data: sessions, isLoading: sessionsLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.getSessions(),
  });

  const updateName = useMutation({
    mutationFn: (name: string) => api.updateMe(name),
    onSuccess: async () => {
      await refreshUser();
    },
  });

  const changePw = useMutation({
    mutationFn: () => api.changePassword(currentPw, newPw),
    onSuccess: () => {
      toast.success('Password updated');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setCurrentPwError('');
      setShowPassword(false);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Failed to change password';
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('wrong')) {
        setCurrentPwError('Incorrect current password');
      } else {
        toast.error(msg);
      }
    },
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked');
      qc.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to revoke'),
  });

  const initials = getInitials(user?.name ?? 'U');
  const passwordsMatch = newPw && confirmPw && newPw === confirmPw;
  const passwordsMismatch = newPw && confirmPw && newPw !== confirmPw;
  const { level: pwLevel } = getPasswordStrength(newPw);
  const canChangePassword = currentPw && newPw.length >= 8 && passwordsMatch && !changePw.isPending;

  async function handleChangePw() {
    setCurrentPwError('');
    await changePw.mutateAsync();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* ── Profile card ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* Avatar + identity header */}
        <div className="p-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <span className="text-xl font-bold text-primary">{initials}</span>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                aria-label="Change avatar"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={() => toast.info('Avatar upload coming soon')}
              />
            </div>

            <div>
              <p className="text-lg font-semibold leading-tight">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.role?.replace(/_/g, ' ')}
                {user?.teams?.length ? ` • ${user.teams.map((t) => t.name).join(', ')}` : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Editable / locked fields */}
        <div className="px-6 py-2">
          {/* Name — inline edit */}
          <div className="flex items-center gap-4 py-3 border-b border-border">
            <span className="text-sm text-muted-foreground w-16 shrink-0">Name</span>
            <div className="flex-1">
              {user ? (
                <InlineEdit
                  value={user.name}
                  onSave={async (v) => {
                    await updateName.mutateAsync(v);
                    toast.success('Name updated');
                  }}
                  validate={(v) => v.length < 2 ? 'Name must be at least 2 characters' : null}
                />
              ) : (
                <Skeleton className="h-5 w-32" />
              )}
            </div>
          </div>

          <LockedField label="Email" value={user?.email ?? ''} />
          <LockedField label="Role" value={user?.role?.replace(/_/g, ' ') ?? ''} />
          <LockedField
            label="Team"
            value={user?.teams?.length ? user.teams.map((t) => t.name).join(', ') : '—'}
          />
        </div>

        <div className="border-t border-border" />

        {/* Password section */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-sm text-muted-foreground tracking-widest mt-0.5">••••••••••</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPassword((s) => !s);
                setCurrentPw('');
                setNewPw('');
                setConfirmPw('');
                setCurrentPwError('');
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showPassword ? (
                <><ChevronUp className="w-4 h-4" /> Cancel</>
              ) : (
                <>Change →</>
              )}
            </button>
          </div>

          {showPassword && (
            <div className="mt-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Current password */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Current password</label>
                <PasswordInput
                  value={currentPw}
                  onChange={(v) => { setCurrentPw(v); setCurrentPwError(''); }}
                  autoFocus
                />
                {currentPwError && (
                  <p className="text-xs text-red-500">{currentPwError}</p>
                )}
              </div>

              {/* New password + strength */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New password</label>
                <PasswordInput value={newPw} onChange={setNewPw} />
                {newPw && <StrengthBar password={newPw} />}
              </div>

              {/* Confirm new password */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm new password</label>
                <PasswordInput
                  value={confirmPw}
                  onChange={setConfirmPw}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canChangePassword) handleChangePw(); }}
                />
                {passwordsMatch && (
                  <p className="text-xs text-green-600 dark:text-green-400">✅ Passwords match</p>
                )}
                {passwordsMismatch && (
                  <p className="text-xs text-red-500">❌ Passwords don't match</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <SmartButton
                  onClick={handleChangePw}
                  loadingText="Updating..."
                  successText="✅ Updated!"
                  disabled={!canChangePassword}
                  size="sm"
                >
                  Update Password
                </SmartButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active sessions ── */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Active sessions</h2>
        {sessionsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                <Skeleton className="w-4 h-4 shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
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
                    className="p-1.5 hover:bg-destructive/10 rounded text-destructive transition-colors disabled:opacity-50"
                    title="Revoke session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
