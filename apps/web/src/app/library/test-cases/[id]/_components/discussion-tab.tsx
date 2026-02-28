'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDiscussions, usePostDiscussion, useDeleteDiscussion } from '@/hooks/use-library';
import { useAuth } from '@/providers/AuthProvider';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { formatTimeAgo } from '@/components/library-badges';

export function DiscussionTab({ id }: { id: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useDiscussions(id);
  const post = usePostDiscussion(id);
  const del = useDeleteDiscussion(id);
  const [message, setMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const discussions = data?.data ?? [];

  useEffect(() => {
    if (discussions.length > 0) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discussions.length]);

  // Auto-grow textarea (1-5 rows)
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    const scrollH = textareaRef.current.scrollHeight;
    const lineH = 24; // ~1 row
    const maxH = lineH * 5;
    textareaRef.current.style.height = `${Math.min(scrollH, maxH)}px`;
  }, [message]);

  const send = useCallback(async () => {
    const msg = message.trim();
    if (!msg) return;

    // Optimistic update
    const optimisticId = crypto.randomUUID();
    const optimistic = {
      id: optimisticId,
      content: msg,
      createdAt: new Date().toISOString(),
      createdById: user?.id ?? '',
      createdBy: { id: user?.id ?? '', name: user?.name ?? 'You' },
    };
    qc.setQueryData(['library-discussions', id], (old: { data: typeof discussions } | undefined) => {
      if (!old) return { data: [optimistic], meta: { total: 1, page: 1, pageSize: 20, totalPages: 1 } };
      return { ...old, data: [...old.data, optimistic] };
    });

    setMessage('');
    try {
      await post.mutateAsync(msg);
    } catch {
      // Revert optimistic update
      qc.setQueryData(['library-discussions', id], (old: { data: typeof discussions } | undefined) => {
        if (!old) return old;
        return { ...old, data: old.data.filter(d => d.id !== optimisticId) };
      });
      toast.error('Failed to post');
      setMessage(msg);
    }
  }, [message, user, id, qc, post]);

  const handleDelete = (discussionId: string) => {
    const discussion = discussions.find(d => d.id === discussionId);
    // Optimistic delete
    qc.setQueryData(['library-discussions', id], (old: { data: typeof discussions } | undefined) => {
      if (!old) return old;
      return { ...old, data: old.data.filter(d => d.id !== discussionId) };
    });

    del.mutate(discussionId, {
      onError: () => {
        // Revert
        qc.setQueryData(['library-discussions', id], (old: { data: typeof discussions } | undefined) => {
          if (!old || !discussion) return old;
          return { ...old, data: [...old.data, discussion].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) };
        });
      },
    });

    toast.success('Comment deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          // Undo is best-effort; re-post if possible
          if (discussion) {
            qc.setQueryData(['library-discussions', id], (old: { data: typeof discussions } | undefined) => {
              if (!old) return old;
              return { ...old, data: [...old.data, discussion].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) };
            });
          }
          qc.invalidateQueries({ queryKey: ['library-discussions', id] });
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Messages */}
      <div className="min-h-[200px] space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5"><div className="h-3 w-24 bg-muted rounded" /><div className="h-12 bg-muted rounded" /></div>
            </div>
          ))
        ) : discussions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No discussion yet</p>
            <p className="text-xs text-muted-foreground mt-1">Share tips, known issues, or implementation notes.</p>
          </div>
        ) : (
          discussions.map(d => {
            const isOwn = user?.id === d.createdById;
            return (
              <div key={d.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{(d.createdBy?.name ?? 'U').charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{d.createdBy?.name ?? 'Unknown'}</span>
                    {isOwn && <span className="text-[10px] text-primary/70 font-medium">you</span>}
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(d.createdAt)}</span>
                  </div>
                  <div className="bg-muted/60 rounded-xl rounded-tl-none px-3 py-2">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{d.content}</p>
                  </div>
                </div>
                {(isOwn || user?.role === 'ADMIN') && (
                  <Button size="icon" variant="ghost"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-8"
                    onClick={() => handleDelete(d.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input at bottom with auto-grow */}
      <div className="flex gap-2 pt-3 border-t border-border">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{(user?.name ?? 'U').charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write a comment… (Enter to send, Shift+Enter for newline)"
            className="resize-none min-h-[40px]"
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Button size="icon" onClick={send} disabled={!message.trim() || post.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
