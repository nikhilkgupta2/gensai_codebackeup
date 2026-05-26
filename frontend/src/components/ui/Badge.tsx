import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

type BadgeTone = 'slate' | 'green' | 'amber' | 'blue' | 'red' | 'violet';

const toneClass: Record<BadgeTone, string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5',
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
