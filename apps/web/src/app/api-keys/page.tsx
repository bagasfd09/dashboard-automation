'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Eye, EyeOff, Copy, Plus, Check, X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { SmartButton } from '@/components/ui/smart-button';
import { cn } from '@/lib/utils';
import type { TeamSummary } from '@/lib/types';

// ── Copy button with feedback ─────────────────────────────────────────────────

function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 text-xs transition-all',
        copied ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span>{copied ? '✅ Copied!' : label}</span>}
    </button>
  );
}

// ── Config template ───────────────────────────────────────────────────────────

function configTemplate(key: string) {
  return `// playwright.config.ts
import { QCMonitorReporter } from "@bagasfd09/qc-monitor-reporter";

export default defineConfig({
  reporter: [
    ['list'],
    [QCMonitorReporter, {
      apiKey: "${key}",
      application: "your-app-slug",
      environment: "staging",
    }],
  ],
});`;
}

// ── Create API Key Modal ──────────────────────────────────────────────────────

function CreateApiKeyModal({
  onClose,
  teams,
}: {
  onClose: () => void;
  teams: TeamSummary[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>(
    user?.role === 'TEAM_LEAD' && user.teams.length > 0
      ? user.teams[0].id
      : (teams[0]?.id ?? ''),
  );
  const [generatedKey, setGeneratedKey] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const isTeamLead = user?.role === 'TEAM_LEAD';
  const selectedTeamName = teams.find((t) => t.id === selectedTeam)?.name ?? '';
  const config = generatedKey ? configTemplate(generatedKey) : '';

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  const generate = useMutation({
    mutationFn: () => api.rotateApiKey(selectedTeam),
    onSuccess: (data) => {
      setGeneratedKey(data.newKey);
      setStep(2);
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to generate key'),
  });

  function requestClose() {
    if (step === 2 && !hasCopied) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  function copyKey(text: string) {
    navigator.clipboard.writeText(text).then(() => setHasCopied(true));
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[520px] animate-in zoom-in-95 duration-150"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold">
              {step === 1 ? 'Create API Key' : '✅ API Key Created!'}
            </h2>
            <button
              onClick={requestClose}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step 1 — Configure */}
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">What's this key for?</label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && name.trim() && selectedTeam) generate.mutate();
                  }}
                  placeholder="e.g. CI/CD Pipeline, Local Development, Staging Tests"
                  className="w-full border border-border rounded-lg px-3.5 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  💡 e.g. "CI/CD Pipeline", "Local Development", "Staging Tests"
                </p>
              </div>

              {!isTeamLead && teams.length > 1 ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Which team?</label>
                  <div className="space-y-1">
                    {teams.map((t) => (
                      <label key={t.id} className="flex items-center gap-2.5 cursor-pointer py-1">
                        <input
                          type="radio"
                          name="create-key-team"
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
              ) : selectedTeamName ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Team</label>
                  <p className="text-sm text-muted-foreground">● {selectedTeamName} (pre-selected)</p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <SmartButton
                  onClick={async () => { await generate.mutateAsync(); }}
                  loadingText="Generating..."
                  disabled={!name.trim() || !selectedTeam}
                >
                  Generate Key →
                </SmartButton>
              </div>
            </div>
          )}

          {/* Step 2 — Reveal key */}
          {step === 2 && (
            <div className="p-6 space-y-5">
              {/* Warning banner */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium leading-snug">
                  Save this key now — you won't see it again!
                </p>
              </div>

              {/* Key display + copy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Your API key</label>
                  <button
                    type="button"
                    onClick={() => copyKey(generatedKey)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    📋 Copy key
                  </button>
                </div>
                <div
                  className="flex items-center justify-between gap-3 bg-muted rounded-xl px-4 py-3 cursor-pointer group hover:bg-muted/80 transition-colors"
                  onClick={() => copyKey(generatedKey)}
                  title="Click to copy"
                >
                  <span className="font-mono text-sm truncate text-foreground">{generatedKey}</span>
                  <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                </div>
                {hasCopied && (
                  <p className="text-xs text-green-600 dark:text-green-400">✅ Key copied!</p>
                )}
              </div>

              {/* Config snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Quick setup — paste into your config:</label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(config).then(() => setHasCopied(true));
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    📋 Copy full config
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-border">
                  <div className="bg-muted/60 px-4 py-2 border-b border-border">
                    <span className="text-xs text-muted-foreground font-mono">playwright.config.ts</span>
                  </div>
                  <pre className="px-4 py-3 text-xs font-mono text-foreground leading-relaxed bg-muted/20 overflow-x-auto">
                    <code>{config}</code>
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
                >
                  <Check className="w-4 h-4" /> Done ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm close without copying */}
      {confirmClose && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-100">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">Have you saved your API key?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You won't be able to see it again once you close this dialog.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Close Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);

  const { data: teams, isLoading } = useQuery<TeamSummary[]>({
    queryKey: ['teams'],
    queryFn: () => api.getTeams(),
  });

  const rotate = useMutation({
    mutationFn: (teamId: string) => api.rotateApiKey(teamId),
    onSuccess: (data, teamId) => {
      toast.success('API key rotated');
      setRevealed((prev) => ({ ...prev, [teamId]: data.newKey }));
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to rotate key'),
  });

  function toggleReveal(teamId: string, key: string) {
    setRevealed((prev) =>
      prev[teamId] ? { ...prev, [teamId]: '' } : { ...prev, [teamId]: key }
    );
  }

  const visibleTeams =
    user?.role === 'ADMIN'
      ? teams
      : teams?.filter((t) => user?.teams.some((ut) => ut.id === t.id));

  const canCreate = user?.permissions?.canManageApiKeys;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use these keys with the{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
              @bagasfd09/qc-monitor-reporter
            </code>{' '}
            to submit test results from your CI pipeline.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-10 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleTeams?.map((team) => {
            const key = revealed[team.id];
            return (
              <div key={team.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{team.name}</h2>
                  <button
                    onClick={() => rotate.mutate(team.id)}
                    disabled={rotate.isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', rotate.isPending && 'animate-spin')} />
                    Rotate key
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm bg-muted rounded-xl px-4 py-2.5 text-muted-foreground overflow-hidden truncate">
                    {key || '••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={() => toggleReveal(team.id, key ?? '')}
                    disabled={!key}
                    className="p-2.5 hover:bg-muted rounded-xl transition-colors disabled:opacity-40"
                    title={key ? 'Hide' : 'Rotate to reveal'}
                  >
                    {key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {key && (
                    <button
                      onClick={() => navigator.clipboard.writeText(key).then(() => toast.success('Copied!'))}
                      className="p-2.5 hover:bg-muted rounded-xl transition-colors"
                      title="Copy key"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Rotating generates a new key. The old key will stop working immediately.
                </p>
              </div>
            );
          })}

          {!isLoading && (visibleTeams?.length ?? 0) === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No teams found</p>
              <p className="text-xs mt-1">API keys are tied to teams.</p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateApiKeyModal
          onClose={() => setShowCreate(false)}
          teams={visibleTeams ?? []}
        />
      )}
    </div>
  );
}
