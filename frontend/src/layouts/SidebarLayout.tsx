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
                   'fixed inset-y-0 left-0 z-50 flex border-r border-white/10 bg-black shadow-xl transition-all duration-200 md:z-30 md:shadow-none',
          collapsed ? 'md:w-[76px]' : 'md:w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          'w-72',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-black text-white shadow-sm">
                <Package2 className="h-4 w-4" />
              </span>
              <div className={cn('min-w-0 transition md:block', collapsed && 'md:hidden')}>
                 <p className="truncate text-sm font-semibold tracking-tight text-slate-950">IMS Operations</p>
                <p className="truncate text-[11px] font-medium text-slate-500">Inventory control plane</p>
              </div>
            </div>
            <button
                            className="grid h-8 w-8 place-items-center rounded-md text-white/70 transition hover:bg-white/5 hover:text-white md:hidden"
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
                    'mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45',
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
                            'flex min-h-10 items-center gap-3 rounded-md bg-[#242424] px-2.5 py-2 text-sm font-medium text-white/80 transition hover:bg-[#2e2e2e] hover:text-white md:min-h-9 md:py-0',
                            collapsed && 'md:justify-center md:px-0',
                            isActive &&
                              'bg-white/10 text-white shadow-sm hover:bg-white/12 hover:text-white',
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

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden h-9 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-black text-sm font-medium text-white transition hover:bg-white/5 md:flex"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span className={cn(collapsed && 'md:hidden')}>Collapse</span>
            </button>
            <div className={cn('mt-3 flex items-center gap-2 rounded-md bg-[#242424] p-2', collapsed && 'md:justify-center')}>
              <PanelLeftClose className="h-4 w-4 text-white/70" />
              <div className={cn('min-w-0', collapsed && 'md:hidden')}>
                <p className="truncate text-xs font-semibold text-white">Workspace settings</p>
                <p className="truncate text-[11px] text-white/60">Role-aware controls</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
