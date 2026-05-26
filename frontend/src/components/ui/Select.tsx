import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition hover:border-slate-300 focus:border-slate-500 focus:shadow-[0_0_0_4px_rgba(15,23,42,0.06)] focus:ring-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = 'Select';
