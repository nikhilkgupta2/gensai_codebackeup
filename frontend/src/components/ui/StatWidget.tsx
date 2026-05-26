import type { ComponentType, ReactNode } from 'react';

import { cn } from '../../lib/cn';

export function StatWidget({
  title,
  value,
  icon: Icon,
  description,
  tone = 'default',
}: {
  title: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  description?: string;
  tone?: 'default' | 'warning' | 'success' | 'info';
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
        </div>
        {Icon ? (
          <div
            className={cn(
              'grid h-9 w-9 place-items-center rounded-md border',
              tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700',
              tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
              tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-700',
              tone === 'default' && 'border-slate-200 bg-slate-50 text-slate-500',
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      {description ? <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p> : null}
    </section>
  );
}
