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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/test-cases', label: 'Test Cases', icon: TestTube },
  { href: '/runs', label: 'Test Runs', icon: Play },
  { href: '/retries', label: 'Retries', icon: RotateCcw },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-zinc-900 border-r border-zinc-800 w-64 flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
        <Activity className="w-5 h-5 text-blue-400" />
        <span className="font-semibold text-white text-sm">QC Monitor</span>
      </div>
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
