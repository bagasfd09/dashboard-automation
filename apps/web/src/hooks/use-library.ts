'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  LibraryTestCaseStatus,
  SuggestionStatus,
  SuggestionType,
  TestPriority,
  TestDifficulty,
} from '@/lib/types';

// ── Collections ────────────────────────────────────────────────────────────────

export function useCollections(teamId?: string) {
  return useQuery({
    queryKey: ['library-collections', teamId],
    queryFn: () => api.getCollections(teamId),
    staleTime: 30_000,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; icon?: string; teamId?: string }) =>
      api.createCollection(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-collections'] }),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string; icon?: string } }) =>
      api.updateCollection(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-collections'] }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCollection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-collections'] }),
  });
}

// ── Library Test Cases ─────────────────────────────────────────────────────────

export function useLibraryTestCases(params: {
  collectionId?: string;
  status?: LibraryTestCaseStatus;
  priority?: TestPriority;
  search?: string;
  tags?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['library-test-cases', params],
    queryFn: () => api.getLibraryTestCases(params),
    staleTime: 30_000,
  });
}

export function useLibraryTestCase(id: string) {
  return useQuery({
    queryKey: ['library-test-case', id],
    queryFn: () => api.getLibraryTestCase(id),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateLibraryTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      priority?: TestPriority;
      difficulty?: TestDifficulty;
      collectionId?: string;
      tags?: string[];
      steps?: string;
      preconditions?: string;
      expectedOutcome?: string;
    }) => api.createLibraryTestCase(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-cases'] }),
  });
}

export function useUpdateLibraryTestCase(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      description?: string;
      priority?: TestPriority;
      difficulty?: TestDifficulty;
      status?: LibraryTestCaseStatus;
      collectionId?: string;
      tags?: string[];
      steps?: string;
      preconditions?: string;
      expectedOutcome?: string;
      changeNotes?: string;
    }) => api.updateLibraryTestCase(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-test-case', id] });
      qc.invalidateQueries({ queryKey: ['library-test-cases'] });
    },
  });
}

export function useDeleteLibraryTestCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLibraryTestCase(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-cases'] }),
  });
}

// ── Links ──────────────────────────────────────────────────────────────────────

export function useLinkTestCase(libraryTestCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) => api.linkTestCase(libraryTestCaseId, testCaseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-case', libraryTestCaseId] }),
  });
}

export function useUnlinkTestCase(libraryTestCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) => api.unlinkTestCase(libraryTestCaseId, testCaseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-case', libraryTestCaseId] }),
  });
}

// ── Coverage ──────────────────────────────────────────────────────────────────

export function useCoverageStats(collectionId?: string) {
  return useQuery({
    queryKey: ['library-coverage', collectionId],
    queryFn: () => api.getCoverageStats(collectionId),
    staleTime: 60_000,
  });
}

export function useCoverageGaps() {
  return useQuery({
    queryKey: ['library-gaps'],
    queryFn: () => api.getCoverageGaps(),
    staleTime: 60_000,
  });
}

// ── Versions ──────────────────────────────────────────────────────────────────

export function useVersions(testCaseId: string, page = 1) {
  return useQuery({
    queryKey: ['library-versions', testCaseId, page],
    queryFn: () => api.getVersions(testCaseId, page),
    staleTime: 30_000,
    enabled: !!testCaseId,
  });
}

export function useRollbackVersion(testCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => api.rollbackVersion(testCaseId, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-test-case', testCaseId] });
      qc.invalidateQueries({ queryKey: ['library-versions', testCaseId] });
    },
  });
}

// ── Suggestions ───────────────────────────────────────────────────────────────

export function useAllSuggestions(params: { status?: SuggestionStatus; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ['library-suggestions-all', params],
    queryFn: () => api.getAllSuggestions(params),
    staleTime: 30_000,
  });
}

export function useSuggestions(testCaseId: string, params: { status?: SuggestionStatus; page?: number } = {}) {
  return useQuery({
    queryKey: ['library-suggestions', testCaseId, params],
    queryFn: () => api.getSuggestions(testCaseId, params),
    staleTime: 30_000,
    enabled: !!testCaseId,
  });
}

export function useCreateSuggestion(testCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: SuggestionType; content: string }) =>
      api.createSuggestion(testCaseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-suggestions', testCaseId] }),
  });
}

export function useReviewSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SuggestionStatus }) =>
      api.reviewSuggestion(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-suggestions-all'] });
      qc.invalidateQueries({ queryKey: ['library-suggestions'] });
    },
  });
}

// ── Discussions ───────────────────────────────────────────────────────────────

export function useDiscussions(testCaseId: string, page = 1) {
  return useQuery({
    queryKey: ['library-discussions', testCaseId, page],
    queryFn: () => api.getDiscussions(testCaseId, page),
    staleTime: 15_000,
    enabled: !!testCaseId,
  });
}

export function usePostDiscussion(testCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.postDiscussion(testCaseId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-discussions', testCaseId] }),
  });
}

export function useDeleteDiscussion(testCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDiscussion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-discussions', testCaseId] }),
  });
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export function useBookmarks(page = 1) {
  return useQuery({
    queryKey: ['library-bookmarks', page],
    queryFn: () => api.getBookmarks(page),
    staleTime: 30_000,
  });
}

export function useToggleBookmark(testCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.toggleBookmark(testCaseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-test-case', testCaseId] });
      qc.invalidateQueries({ queryKey: ['library-bookmarks'] });
    },
  });
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export function useAddDependency(libraryTestCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependsOnId: string) => api.addDependency(libraryTestCaseId, dependsOnId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-case', libraryTestCaseId] }),
  });
}

export function useRemoveDependency(libraryTestCaseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dependsOnId: string) => api.removeDependency(libraryTestCaseId, dependsOnId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['library-test-case', libraryTestCaseId] }),
  });
}
