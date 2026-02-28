'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, ChevronDown, Plus, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  libraryTestCaseId: string;
  libraryTestCaseTitle: string;
}

export function AddToMyTasksButton({ libraryTestCaseId, libraryTestCaseTitle }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addingToId, setAddingToId] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['task-groups', 'mine', 'ACTIVE'],
    queryFn: () => api.listTaskGroups({ status: 'ACTIVE' }),
    enabled: open,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: (groupId: string) =>
      api.addTaskGroupItems(groupId, [libraryTestCaseId]),
    onSuccess: (result, groupId) => {
      const group = groups.find((g) => g.id === groupId);
      if (result.duplicates > 0) {
        toast.success(`Already in ${group?.name ?? 'task group'}`);
      } else {
        toast.success(`Added to ${group?.name ?? 'task group'}`);
        queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      }
      setOpen(false);
      setAddingToId(null);
    },
    onError: () => {
      toast.error('Failed to add to task group');
      setAddingToId(null);
    },
  });

  const handleAdd = async (groupId: string) => {
    setAddingToId(groupId);
    await addMutation.mutateAsync(groupId);
  };

  const handleCreateNew = () => {
    setOpen(false);
    // Navigate to my tasks page — they can create from there
    router.push('/my-tasks');
  };

  const calcProgress = (g: typeof groups[0]) => {
    if (g.progress.total === 0) return '';
    return `${g.progress.localPassed + g.progress.skipped}/${g.progress.total}`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/5">
          <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
          Add to My Tasks
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {isLoading ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">No active task groups</div>
        ) : (
          groups.map((group) => {
            const isAdding = addingToId === group.id;
            const progress = calcProgress(group);
            return (
              <DropdownMenuItem
                key={group.id}
                onClick={() => handleAdd(group.id)}
                disabled={isAdding}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{group.name}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {isAdding ? <Check className="h-3 w-3 animate-spin" /> : progress}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCreateNew}>
          <Plus className="h-3.5 w-3.5 mr-2" />
          Create New Task Group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
