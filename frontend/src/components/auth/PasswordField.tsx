import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

import { Input } from '../Input';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <label className="block space-y-1.5 text-sm font-medium text-white/80">
        <span className="text-xs">{label}</span>
        <div className="group relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45 transition group-focus-within:text-white/80" />
          <Input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className="h-10 rounded-md border-white/20 bg-[#111] pl-10 pr-11 text-white shadow-none transition placeholder:text-white/40 hover:border-white/30 focus:border-white/50 focus:bg-[#0f0f0f] focus:shadow-[0_0_0_4px_rgba(255,255,255,0.06)]"
            {...props}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-white/45 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? <span className="block text-xs font-normal text-red-200">{error}</span> : null}
      </label>
    );
  },
);

PasswordField.displayName = 'PasswordField';
