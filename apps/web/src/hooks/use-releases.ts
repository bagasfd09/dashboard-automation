'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ReleaseStatus, ChecklistItemStatus, ChecklistItemType } from '@/lib/types';

export function useReleases(params: { teamId?: string; status?: ReleaseStatus; search?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: ['releases', params],
    queryFn: () => api.getReleases(params),
    staleTime: 60_000,
  });
}

export function useRelease(id: string) {
  return useQuery({
    queryKey: ['release', id],
    queryFn: () => api.getRelease(id),
    staleTime: 15_000,
    enabled: !!id,
  });
}

export function useCreateRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; version: string; description?: string; teamId?: string; targetDate?: string }) =>
      api.createRelease(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

export function useUpdateRelease(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; version?: string; description?: string; targetDate?: string | null; status?: ReleaseStatus }) =>
      api.updateRelease(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['release', id] });
      qc.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

export function useDeleteRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRelease(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releases'] }),
  });
}

export function useMarkReleased(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markReleased(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['release', id] });
      qc.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

export function useCancelRelease(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelRelease(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['release', id] });
      qc.invalidateQueries({ queryKey: ['releases'] });
    },
  });
}

export function useAddChecklistItem(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: ChecklistItemType; title: string; description?: string; libraryTestCaseId?: string; testCaseId?: string }) =>
      api.addChecklistItem(releaseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release', releaseId] }),
  });
}

export function useUpdateChecklistItem(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { title?: string; description?: string; status?: ChecklistItemStatus; notes?: string } }) =>
      api.updateChecklistItem(releaseId, itemId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release', releaseId] }),
  });
}

export function useDeleteChecklistItem(releaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.deleteChecklistItem(releaseId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['release', releaseId] }),
  });
}
