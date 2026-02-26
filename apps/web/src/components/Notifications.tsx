'use client';

import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';

export { toast } from 'sonner';

export function Notifications() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{ duration: 5000 }}
    />
  );
}
