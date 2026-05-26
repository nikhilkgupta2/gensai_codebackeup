import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

import { cn } from '../../lib/cn';

type LandingButtonProps = {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
};

export function LandingButton({ to, children, variant = 'primary', className }: LandingButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md px-5 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
        variant === 'primary' && 'bg-slate-950 text-white shadow-sm hover:bg-slate-800',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
        className,
      )}
    >
      {children}
    </Link>
  );
}
