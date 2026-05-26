import React from 'react';
import type { InputHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export const Input = React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-md border border-slate-200 bg-white/90 px-3 text-sm font-medium text-slate-800 outline-none transition duration-200 placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(15,23,42,0.06)] focus:ring-0',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
