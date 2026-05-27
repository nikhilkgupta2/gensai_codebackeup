import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Package2, PanelLeftClose, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { UserRole } from '../lib/auth-store';
import { cn } from '../lib/cn';
import { getVisibleNavigationGroups } from '../navigation/appNavigation';

type SidebarLayoutProps = {
  role?: UserRole | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

export function SidebarLayout({
  role,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
}: SidebarLayoutProps) {
  const groups = getVisibleNavigationGroups(role);

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMobile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/40 transition-opacity md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex border-r border-slate-200 bg-white shadow-xl transition-all duration-200 md:z-30 md:shadow-none dark:border-white/10 dark:bg-black',
          collapsed ? 'md:w-[76px]' : 'md:w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'w-72',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-950 text-white shadow-sm dark:border dark:border-white/10 dark:bg-black">
                <Package2 className="h-4 w-4" />
              </span>
              <div className={cn('min-w-0 transition md:block', collapsed && 'md:hidden')}>
                <p className="truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">IMS Operations</p>
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-white/60">Inventory control plane</p>
              </div>
            </div>
            <button
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
              onClick={onCloseMobile}
              type="button"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {groups.map((group) => (
              <div key={group.label}>
                <p
                  className={cn(
                    'mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-white/45',
                    collapsed && 'md:text-center md:text-[0px]',
                  )}
                >
                  {collapsed ? <span className="hidden md:inline">-</span> : group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const itemContent = (
                      <>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={cn('truncate', collapsed && 'md:hidden')}>{item.label}</span>
                      </>
                    );

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onCloseMobile}
                        title={item.label}
                        className={({ isActive }) =>
                          cn(
                            'flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 md:min-h-9 md:py-0 dark:bg-transparent dark:text-white/80 dark:hover:bg-transparent dark:hover:text-white',
                            collapsed && 'md:justify-center md:px-0',
                            isActive &&
                              'bg-slate-950 text-white shadow-sm hover:bg-slate-950 hover:text-white dark:bg-white/10 dark:text-white dark:hover:bg-white/10 dark:hover:text-white',
                          )
                        }
                      >
                        {itemContent}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-200 p-3 dark:border-white/10">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 md:flex dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-white/5"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span className={cn(collapsed && 'md:hidden')}>Collapse</span>
            </button>
            <div
              className={cn(
                'mt-3 flex items-center gap-2 rounded-md bg-slate-50 p-2 dark:bg-white/5',
                collapsed && 'md:justify-center',
              )}
            >
              <PanelLeftClose className="h-4 w-4 text-slate-500 dark:text-white/70" />
              <div className={cn('min-w-0', collapsed && 'md:hidden')}>
                <p className="truncate text-xs font-semibold text-slate-700 dark:text-white">Workspace settings</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-white/60">Role-aware controls</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
