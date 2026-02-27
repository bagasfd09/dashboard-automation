'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  TestTube,
  Play,
  Settings,
  Activity,
  RotateCcw,
  Key,
  ScrollText,
  UserCircle,
  LogOut,
  ChevronDown,
  UserCog,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/providers/AuthProvider';
import type { UserRole } from '@/lib/types';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const links: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/test-cases', label: 'Test Cases', icon: TestTube },
  { href: '/runs', label: 'Test Runs', icon: Play },
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/retries', label: 'Retries', icon: RotateCcw, roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER'] },
  { href: '/users', label: 'Users', icon: UserCog, roles: ['ADMIN', 'MANAGER', 'TEAM_LEAD'] },
  { href: '/api-keys', label: 'API Keys', icon: Key, roles: ['ADMIN', 'TEAM_LEAD'] },
  { href: '/activity', label: 'Activity Log', icon: ScrollText, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
];

function RoleBadge({ role }: { role: UserRole }) {
  const colors: Record<UserRole, string> = {
    ADMIN: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    MANAGER: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    SUPERVISOR: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    TEAM_LEAD: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    MEMBER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    MONITORING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  };
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', colors[role])}>
      {role}
    </span>
  );
}

const PREFETCH_STALE = 30_000; // 30s — matches query staleTime

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const visibleLinks = links.filter(
    (l) => !l.roles || (user?.role && l.roles.includes(user.role))
  );

  const prefetchForRoute = useCallback(
    (href: string) => {
      switch (href) {
        case '/':
          queryClient.prefetchQuery({ queryKey: ['overview'], queryFn: api.getOverview, staleTime: PREFETCH_STALE });
          queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: api.getTeams, staleTime: PREFETCH_STALE });
          break;
        case '/teams':
          queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: api.getTeams, staleTime: PREFETCH_STALE });
          break;
        case '/runs':
          queryClient.prefetchQuery({ queryKey: ['runs', 1, 20, undefined], queryFn: () => api.getRuns({ page: 1, pageSize: 20 }), staleTime: PREFETCH_STALE });
          break;
        case '/test-cases':
          queryClient.prefetchQuery({ queryKey: ['test-cases-grouped', { groupBy: 'suite', page: 1 }], queryFn: () => api.getTestCasesGrouped({ groupBy: 'suite', page: 1, pageSize: 10 }), staleTime: PREFETCH_STALE });
          break;
        case '/library':
          queryClient.prefetchQuery({ queryKey: ['library-collections', undefined], queryFn: () => api.getCollections(), staleTime: PREFETCH_STALE });
          break;
        case '/retries':
          queryClient.prefetchQuery({ queryKey: ['retries', 1, 20], queryFn: () => api.getRetries({ page: 1, pageSize: 20 }), staleTime: PREFETCH_STALE });
          break;
        case '/users':
          queryClient.prefetchQuery({ queryKey: ['users', {}], queryFn: () => api.getUsers({}), staleTime: PREFETCH_STALE });
          break;
        case '/activity':
          queryClient.prefetchQuery({ queryKey: ['activity', 1, ''], queryFn: () => api.getActivityLog({ page: 1, pageSize: 25 }), staleTime: PREFETCH_STALE });
          break;
      }
    },
    [queryClient],
  );

  return (
    <aside className="bg-sidebar border-r border-sidebar-border w-64 flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
        <Activity className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sidebar-active-text text-sm">QC Monitor</span>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {visibleLinks.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onMouseEnter={() => prefetchForRoute(href)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-sidebar-active text-sidebar-active-text font-medium'
                  : 'text-sidebar-foreground hover:text-sidebar-active-text hover:bg-sidebar-hover'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border">
        {/* User menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-sidebar-hover transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-active-text truncate">{user.name}</p>
                <p className="text-[10px] text-sidebar-foreground truncate">{user.email}</p>
              </div>
              <ChevronDown className={cn('w-3.5 h-3.5 text-sidebar-foreground transition-transform', userMenuOpen && 'rotate-180')} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <RoleBadge role={user.role} />
                  {user.teams.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                      {user.teams.map((t) => t.name).join(', ')}
                    </p>
                  )}
                </div>
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <UserCircle className="w-4 h-4" />
                  Profile
                </Link>
                <button
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        <div className="p-3 border-t border-sidebar-border">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
