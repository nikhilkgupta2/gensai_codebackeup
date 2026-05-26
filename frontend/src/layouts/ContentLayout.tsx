import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export function ContentLayout({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-screen min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200',
        collapsed ? 'md:pl-[76px]' : 'md:pl-72',
      )}
    >
      {children}
    </div>
  );
}

export function ScrollableContent({ children }: { children: ReactNode }) {
   return <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 text-slate-950 dark:bg-[#242424] dark:text-white">{children}</div>;
}
