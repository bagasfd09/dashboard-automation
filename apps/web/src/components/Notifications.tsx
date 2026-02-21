'use client';

import { Toaster } from 'sonner';

export { toast } from 'sonner';

export function Notifications() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        duration: 5000,
        classNames: {
          toast: 'bg-zinc-900 border border-zinc-700 text-zinc-100',
          title: 'text-zinc-100',
          description: 'text-zinc-400',
          success: 'border-green-500/40',
          error: 'border-red-500/40',
          info: 'border-blue-500/40',
        },
      }}
    />
  );
}
