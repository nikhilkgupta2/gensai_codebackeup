import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export function DataTable({
  children,
  className,
  density = 'normal',
  minWidth = 'min-w-full',
  scrollClassName,
}: {
  children: ReactNode;
  className?: string;
  density?: 'compact' | 'normal';
  minWidth?: string;
  scrollClassName?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm',
        density === 'compact' && 'text-[13px]',
        className,
      )}
    >
      <div
        className={cn(
          'max-w-full touch-pan-x overflow-x-auto overscroll-x-contain focus:outline-none focus:ring-2 focus:ring-slate-200',
          scrollClassName,
        )}
        tabIndex={0}
      >
        <table className={cn(minWidth, 'divide-y divide-slate-200 text-left', density === 'compact' ? 'text-[13px]' : 'text-sm')}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function DataTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-[1] bg-slate-50/95 text-[11px] uppercase tracking-[0.06em] text-slate-500 backdrop-blur">
      {children}
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}

export function DataTableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('transition hover:bg-slate-50/80', className)}>{children}</tr>;
}

export function DataTableHead({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('whitespace-nowrap px-3 py-2.5 font-semibold', className)}>{children}</th>;
}

export function DataTableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('whitespace-nowrap px-3 py-2.5 align-middle text-slate-600', className)}>{children}</td>;
}
