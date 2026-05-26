import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/cn';

export function LoadingState({
  label = 'Loading...',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-sm font-medium text-slate-500', className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}
