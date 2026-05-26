import { forwardRef } from 'react';
import type { ComponentType, InputHTMLAttributes } from 'react';

import { Input } from '../Input';

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: ComponentType<{ className?: string }>;
  error?: string;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, icon: Icon, error, ...props }, ref) => {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-white/80">
      <span className="text-xs">{label}</span>
      <div className="group relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45 transition group-focus-within:text-white/80" />
        <Input
          ref={ref}
          className="h-10 rounded-md border-white/20 bg-[#111] pl-10 text-white shadow-none transition placeholder:text-white/40 hover:border-white/30 focus:border-white/50 focus:bg-[#0f0f0f] focus:shadow-[0_0_0_4px_rgba(255,255,255,0.06)]"
          {...props}
        />
      </div>
      {error ? <span className="block text-xs font-normal text-red-200">{error}</span> : null}
    </label>
  );
  },
);

AuthField.displayName = 'AuthField';
