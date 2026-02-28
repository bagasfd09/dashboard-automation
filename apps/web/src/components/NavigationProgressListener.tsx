'use client';
import { useEffect } from 'react';
import NProgress from 'nprogress';

export function NavigationProgressListener() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      const isInternal = href.startsWith('/');
      const isSamePage = href === window.location.pathname;
      const isNewTab = target.getAttribute('target') === '_blank';

      if (isInternal && !isSamePage && !isNewTab) {
        NProgress.start();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
