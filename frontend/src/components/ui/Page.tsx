import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <PageContainer className={className}>{children}</PageContainer>;
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cn('mx-auto w-full max-w-[1680px] px-3 py-3 sm:px-5 sm:py-4 lg:px-6', className)}>
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)}>{children}</section>;
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function DashboardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6', className)}>{children}</div>;
}

export function TableContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <SectionCard className={cn('overflow-hidden', className)}>{children}</SectionCard>;
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:gap-3 md:flex-row md:flex-wrap md:items-center', className)}>
      {children}
    </div>
  );
}
