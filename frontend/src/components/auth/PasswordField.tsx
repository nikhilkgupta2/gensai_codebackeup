import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

import { Input } from '../Input';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  sideHint?: ReactNode;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, sideHint, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <label className="block space-y-1.5 text-sm font-medium text-slate-700 dark:text-white/80">
        <span className="text-xs">{label}</span>
        <div className="group relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-slate-700 dark:text-white/45 dark:group-focus-within:text-white/80" />
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className="h-10 rounded-md border-slate-200 bg-slate-50/70 pl-10 pr-11 shadow-none transition focus:bg-white dark:!border-white/95 dark:bg-[#111] dark:text-white dark:placeholder:text-white/40 dark:hover:!border-white/50 dark:focus:!border-white/70 dark:focus:bg-[#0f0f0f] dark:focus:shadow-[0_0_0_4px_rgba(255,255,255,0.06)]"
            {...props}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white dark:focus:ring-white/20"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          {sideHint}
        </div>
        {error ? <span className="block text-xs font-normal text-red-600 dark:text-red-200">{error}</span> : null}
      </label>
    );
  },
);

PasswordField.displayName = 'PasswordField';
