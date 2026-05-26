import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '../../lib/cn';

export function Modal({
  title,
  description,
  children,
  onClose,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className={cn('max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl', className)}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
