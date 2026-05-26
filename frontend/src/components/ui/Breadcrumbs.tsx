import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {item.to && !isLast ? (
              <Link to={item.to} className="font-medium text-slate-600 hover:text-slate-950">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-slate-700' : undefined}>{item.label}</span>
            )}
            {!isLast ? <ChevronRight className="h-3 w-3 text-slate-400" /> : null}
          </span>
        );
      })}
    </nav>
  );
}
