'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { TeamSummary } from '@/lib/types';

export default function ApiKeysPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [revealed, setRevealed] = useState<Record<string, string>>({});

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

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  }

  function toggleReveal(teamId: string, key: string) {
    setRevealed((prev) =>
      prev[teamId] ? { ...prev, [teamId]: '' } : { ...prev, [teamId]: key }
    );
  }

  const visibleTeams =
    user?.role === 'ADMIN'
      ? teams
      : teams?.filter((t) => user?.teams.some((ut) => ut.id === t.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">API Keys</h1>
      <p className="text-sm text-muted-foreground">
        Use these keys with the <code className="bg-muted px-1.5 py-0.5 rounded text-xs">x-api-key</code> header when submitting test results from your CI pipeline.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-4">
          {visibleTeams?.map((team) => {
            const key = revealed[team.id];
            return (
              <div key={team.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{team.name}</h2>
                  <button
                    onClick={() => rotate.mutate(team.id)}
                    disabled={rotate.isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rotate.isPending ? 'animate-spin' : ''}`} />
                    Rotate
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm bg-muted rounded-md px-3 py-2 text-muted-foreground overflow-hidden">
                    {key ? key : '••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                  <button
                    onClick={() => toggleReveal(team.id, key ?? '')}
                    disabled={!key}
                    className="p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-40"
                    title={key ? 'Hide' : 'Rotate to reveal'}
                  >
                    {key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {key && (
                    <button
                      onClick={() => copy(key)}
                      className="p-2 hover:bg-muted rounded-md transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Rotate to generate a new key. The old key will stop working immediately.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
