'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  TestTube2,
  Play,
  RotateCcw,
  BookOpen,
  Package,
  Users,
  Settings,
  UserCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Activity,
  BarChart3,
  LayoutGrid,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/providers/AuthProvider';
import { useAppContext } from '@/providers/AppContextProvider';
import type { UserRole, Application } from '@/lib/types';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  roles?: UserRole[];
  disabled?: boolean;
  comingSoon?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  defaultOpen: boolean;
  items: NavItem[];
}

// ── Nav structure ─────────────────────────────────────────────────────────────

const ALL_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER', 'MONITORING'];

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { href: '/', label: 'Dashboard', roles: ALL_ROLES },
      { href: '/applications', label: 'Applications', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'] },
      { href: '#analytics', label: 'Analytics', disabled: true, comingSoon: true, roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'] },
    ],
  },
  {
    id: 'testing',
    label: 'Testing',
    icon: TestTube2,
    defaultOpen: true,
    items: [
      { href: '/test-cases', label: 'Test Cases', roles: ALL_ROLES },
      { href: '/runs', label: 'Test Runs', roles: ALL_ROLES },
      { href: '/retries', label: 'Retries', roles: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'MEMBER'] },
      { href: '/my-tasks', label: 'My Tasks', roles: ['MEMBER', 'TEAM_LEAD'] },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    icon: BookOpen,
    defaultOpen: true,
    items: [
      { href: '/library', label: 'Collections', roles: ALL_ROLES },
      { href: '/library?tab=coverage', label: 'Coverage', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'] },
      { href: '/task-progress', label: 'Task Progress', roles: ['TEAM_LEAD', 'MANAGER', 'ADMIN'] },
    ],
  },
  {
    id: 'releases',
    label: 'Releases',
    icon: Package,
    defaultOpen: false,
    items: [
      { href: '/releases', label: 'Active', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD', 'MEMBER'] },
      { href: '/releases?tab=history', label: 'History', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'] },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    icon: Users,
    defaultOpen: false,
    items: [
      { href: '/teams', label: 'Teams', roles: ['ADMIN', 'MANAGER'] },
      { href: '/users', label: 'Users', roles: ['ADMIN', 'MANAGER', 'TEAM_LEAD'] },
      { href: '/api-keys', label: 'API Keys', roles: ['ADMIN', 'MANAGER', 'TEAM_LEAD'] },
      { href: '/activity', label: 'Activity Log', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'TEAM_LEAD'] },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    defaultOpen: false,
    items: [
      { href: '/settings', label: 'Settings', roles: ['ADMIN'] },
      { href: '/profile', label: 'Profile', roles: ALL_ROLES },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PREFETCH_STALE = 30_000;
const STORAGE_KEY = 'sidebar-groups';

function loadGroupState(defaults: Record<string, boolean>): Record<string, boolean> {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function RoleBadge({ role }: { role: UserRole }) {
  const colors: Record<UserRole, string> = {
    ADMIN:      'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    MANAGER:    'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
    SUPERVISOR: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    TEAM_LEAD:  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
    MEMBER:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    MONITORING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  };
  return (
    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', colors[role])}>
      {role}
    </span>
  );
}

// ── App Context Switcher ──────────────────────────────────────────────────────

function AppSwitcher() {
  const { selectedApp, selectedEnv, setSelectedApp, setSelectedEnv, clearAppContext } = useAppContext();
  const [open, setOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);

  const { data: apps = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: api.getApplications,
    staleTime: 60_000,
  });

  const label = selectedApp
    ? selectedApp.name + (selectedEnv ? ` · ${selectedEnv}` : '')
    : 'Portfolio (All)';

  const iconChar = selectedApp?.icon || (selectedApp ? selectedApp.name.charAt(0).toUpperCase() : null);
  const color = selectedApp?.color ?? '#6b7280';

  return (
    <div className="px-3 py-2 border-b border-sidebar-border">
      {/* App picker */}
      <div className="relative">
        <button
          onClick={() => { setOpen(o => !o); setEnvOpen(false); }}
          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-sidebar-hover transition-colors"
        >
          <div
            className="h-6 w-6 shrink-0 rounded flex items-center justify-center text-[11px] font-bold text-white"
            style={{ backgroundColor: selectedApp ? color : '#3b82f6' }}
          >
            {iconChar ?? '⊞'}
          </div>
          <span className="flex-1 min-w-0 text-xs font-medium text-sidebar-active-text truncate">{label}</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg py-1 max-h-56 overflow-y-auto">
            {/* Portfolio option */}
            <button
              onClick={() => { clearAppContext(); setOpen(false); }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                !selectedApp && 'font-medium',
              )}
            >
              <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-left">Portfolio (All)</span>
              {!selectedApp && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </button>

            {apps.length > 0 && <div className="my-1 border-t" />}

            {apps.map((app: Application) => (
              <button
                key={app.id}
                onClick={() => { setSelectedApp(app); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  selectedApp?.id === app.id && 'font-medium',
                )}
              >
                <div
                  className="h-4 w-4 shrink-0 rounded text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ backgroundColor: app.color ?? '#6b7280' }}
                >
                  {app.icon || app.name.charAt(0)}
                </div>
                <span className="flex-1 text-left truncate">{app.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{app.slug}</span>
                {selectedApp?.id === app.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Env picker — only when an app is selected and has envs */}
      {selectedApp && selectedApp.environments.length > 0 && (
        <div className="relative mt-1">
          <button
            onClick={() => { setEnvOpen(o => !o); setOpen(false); }}
            className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-sidebar-hover transition-colors"
          >
            <span className="text-[10px] text-muted-foreground">Env:</span>
            <span className="flex-1 text-xs text-sidebar-foreground truncate">
              {selectedEnv ?? 'All environments'}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>

          {envOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border bg-popover shadow-lg py-1">
              <button
                onClick={() => { setSelectedEnv(null); setEnvOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  !selectedEnv && 'font-medium',
                )}
              >
                <span className="flex-1 text-left">All environments</span>
                {!selectedEnv && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
              {selectedApp.environments.map((env) => (
                <button
                  key={env}
                  onClick={() => { setSelectedEnv(env); setEnvOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                    selectedEnv === env && 'font-medium',
                  )}
                >
                  <span className="flex-1 text-left">{env}</span>
                  {selectedEnv === env && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Nav section (needs useSearchParams — must be wrapped in Suspense) ──────────

interface NavSectionProps {
  visibleGroups: NavGroup[];
  openGroups: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  onPrefetch: (href: string) => void;
}

function NavSection({ visibleGroups, openGroups, onToggleGroup, onPrefetch }: NavSectionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Active detection that handles both plain paths and tab-based paths.
   *
   * Rule:
   *  - Item has ?tab=X  → active only when pathname matches AND current tab === X
   *  - Item has no tab  → active only when pathname matches AND current tab is NOT
   *                        one of the tabs used by sibling items in the same group
   */
  function isItemActive(href: string, groupItems: NavItem[]): boolean {
    const [hrefPath, hrefQuery] = href.split('?');
    if (hrefPath === '/') return pathname === '/';
    if (!pathname.startsWith(hrefPath)) return false;

    const hrefTab = hrefQuery ? new URLSearchParams(hrefQuery).get('tab') : null;
    const currentTab = searchParams.get('tab');

    if (hrefTab !== null) {
      // Tab item: active only when the current tab matches
      return currentTab === hrefTab;
    }

    // Non-tab item: active when no sibling's tab is currently selected
    const siblingTabs = groupItems
      .filter(s => s.href !== href && s.href.includes('?tab='))
      .map(s => new URLSearchParams(s.href.split('?')[1] ?? '').get('tab'));

    return !siblingTabs.includes(currentTab);
  }

  function isGroupActive(group: NavGroup): boolean {
    return group.items.some(item => isItemActive(item.href, group.items));
  }

  return (
    <nav className="flex-1 overflow-y-auto py-2">
      {visibleGroups.map(group => {
        const GroupIcon = group.icon;
        const isOpen = openGroups[group.id] ?? group.defaultOpen;
        const groupActive = isGroupActive(group);

        return (
          <div key={group.id} className="mb-1">
            {/* Group header */}
            <button
              onClick={() => onToggleGroup(group.id)}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors',
                'hover:bg-sidebar-hover',
                groupActive ? 'text-sidebar-active-text' : 'text-muted-foreground',
              )}
            >
              <GroupIcon className={cn('w-4 h-4 shrink-0', groupActive && 'text-primary')} />
              <span className="flex-1 text-[11px] font-semibold uppercase tracking-widest">
                {group.label}
              </span>
              {isOpen
                ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
              }
            </button>

            {/* Animated items container */}
            <div
              style={{
                maxHeight: isOpen ? '400px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 200ms ease-in-out',
              }}
            >
              <div className="pb-1">
                {group.items.map(item => {
                  // Disabled / coming soon item
                  if (item.disabled) {
                    return (
                      <div
                        key={item.href}
                        className="flex items-center gap-2 pl-10 pr-4 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                      >
                        <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.comingSoon && (
                          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">
                            Soon
                          </span>
                        )}
                      </div>
                    );
                  }

                  const active = isItemActive(item.href, group.items);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onMouseEnter={() => onPrefetch(item.href)}
                      className={cn(
                        'flex items-center pl-10 pr-4 py-1.5 text-sm transition-colors relative',
                        active
                          ? 'bg-sidebar-active text-sidebar-active-text font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-primary before:rounded-r'
                          : 'text-sidebar-foreground hover:text-sidebar-active-text hover:bg-sidebar-hover',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ── Sidebar shell ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const role = user?.role;

  // Accordion open/close state — persisted to localStorage
  const defaults = Object.fromEntries(NAV_GROUPS.map(g => [g.id, g.defaultOpen]));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => loadGroupState(defaults));

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)); } catch { /* ignore */ }
  }, [openGroups]);

  function toggleGroup(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  }

  // Role-based filtering
  function visibleItems(items: NavItem[]): NavItem[] {
    if (!role) return [];
    return items.filter(i => !i.roles || i.roles.includes(role));
  }
  const visibleGroups = NAV_GROUPS
    .map(g => ({ ...g, items: visibleItems(g.items) }))
    .filter(g => g.items.length > 0);

  // Prefetch data on hover
  const prefetchForHref = useCallback(
    (href: string) => {
      const path = href.split('?')[0];
      switch (path) {
        case '/':
          queryClient.prefetchQuery({ queryKey: ['overview', undefined], queryFn: () => api.getOverview(), staleTime: 30_000 });
          queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: api.getTeams, staleTime: 300_000 });
          break;
        case '/applications':
          queryClient.prefetchQuery({ queryKey: ['applications'], queryFn: api.getApplications, staleTime: 60_000 });
          break;
        case '/teams':
          queryClient.prefetchQuery({ queryKey: ['teams'], queryFn: api.getTeams, staleTime: 300_000 });
          break;
        case '/runs':
          queryClient.prefetchQuery({ queryKey: ['runs', 1, 20, undefined, undefined, undefined, undefined, undefined], queryFn: () => api.getRuns({ page: 1, pageSize: 20 }), staleTime: 15_000 });
          break;
        case '/test-cases':
          queryClient.prefetchQuery({ queryKey: ['test-cases-grouped', { groupBy: 'suite', page: 1 }], queryFn: () => api.getTestCasesGrouped({ groupBy: 'suite', page: 1, pageSize: 10 }), staleTime: 30_000 });
          break;
        case '/library':
          queryClient.prefetchQuery({ queryKey: ['library-collections', undefined], queryFn: () => api.getCollections(), staleTime: 120_000 });
          break;
        case '/releases':
          queryClient.prefetchQuery({ queryKey: ['releases', {}], queryFn: () => api.getReleases({ pageSize: 100 }), staleTime: 60_000 });
          break;
        case '/retries':
          queryClient.prefetchQuery({ queryKey: ['retries', 1, 20], queryFn: () => api.getRetries({ page: 1, pageSize: 20 }), staleTime: 30_000 });
          break;
        case '/users':
          queryClient.prefetchQuery({ queryKey: ['users', {}], queryFn: () => api.getUsers({}), staleTime: 300_000 });
          break;
        case '/activity':
          queryClient.prefetchQuery({ queryKey: ['activity', 1, ''], queryFn: () => api.getActivityLog({ page: 1, pageSize: 25 }), staleTime: 30_000 });
          break;
      }
    },
    [queryClient],
  );

  return (
    <aside className="bg-sidebar border-r border-sidebar-border w-64 flex flex-col shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-sidebar-border shrink-0">
        <Activity className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sidebar-active-text text-sm">QC Monitor</span>
      </div>

      {/* App + Env context switcher */}
      <AppSwitcher />

      {/*
        NavSection uses useSearchParams() which requires Suspense in Next.js App Router.
        The fallback renders nothing (nav is invisible during the brief SSR→hydration gap).
      */}
      <Suspense fallback={<div className="flex-1" />}>
        <NavSection
          visibleGroups={visibleGroups}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
          onPrefetch={prefetchForHref}
        />
      </Suspense>

      {/* Bottom: user info + theme */}
      <div className="border-t border-sidebar-border shrink-0">
        {user && (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(o => !o)}
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
                      {user.teams.map(t => t.name).join(', ')}
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
