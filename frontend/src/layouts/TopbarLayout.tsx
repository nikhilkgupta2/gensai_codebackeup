import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, Menu, Plus, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AuthUser } from '../lib/auth-store';
import { ROLE_LABELS } from '../permissions/capabilities';
import { getRouteLabel } from '../navigation/appNavigation';

type TopbarLayoutProps = {
  user: AuthUser | null;
  onOpenMobile: () => void;
  onLogout: () => void;
};

export function TopbarLayout({ user, onOpenMobile, onLogout }: TopbarLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = getRouteLabel(location.pathname);
  const [search, setSearch] = useState('');

  const handleGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = search.trim();
    if (!value) {
      return;
    }
    if (user?.role === 'super_admin') {
      navigate('/app');
      return;
    }
    navigate(`/products?product_name=${encodeURIComponent(value)}&page=1&limit=10`);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-5">
        <button
          className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 md:hidden"
          onClick={onOpenMobile}
          type="button"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="hidden min-w-0 flex-col lg:flex">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <span>{route.group}</span>
            <span>/</span>
            <span className="text-slate-700">{route.label}</span>
          </div>
          <p className="text-sm font-semibold text-slate-950">{route.label}</p>
        </div>

        <form className="relative hidden min-w-0 flex-1 sm:block lg:max-w-xl" onSubmit={handleGlobalSearch}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,23,42,0.06)] sm:h-9"
            placeholder="Search products, SKUs, orders..."
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>

        <button
          className="hidden h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition hover:bg-slate-800 xl:inline-flex"
          type="button"
          onClick={() => navigate('/inventory')}
        >
          <Plus className="h-4 w-4" />
          Quick action
        </button>

        <ThemeToggle />

        <NotificationCenter user={user} />

        <div className="hidden h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 xl:flex">
          <span className="max-w-[140px] truncate">{user?.tenant_id ? 'Retailer workspace' : 'Platform workspace'}</span>
        </div>

        <div className="group relative">
          <button
            className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-left transition hover:bg-slate-50"
            type="button"
          >
            <span className="grid h-6 w-6 place-items-center rounded bg-slate-900 text-[11px] font-semibold text-white">
              {user?.name?.slice(0, 1).toUpperCase() ?? 'I'}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-[120px] truncate text-xs font-semibold text-slate-800">{user?.name ?? 'Inventory team'}</span>
              <span className="block max-w-[120px] truncate text-[11px] text-slate-500">
                {user ? ROLE_LABELS[user.role] : 'Workspace user'}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
          </button>
          <div className="invisible absolute right-0 top-10 w-56 rounded-md border border-slate-200 bg-white p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <div className="border-b border-slate-100 px-2 py-2">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.email ?? 'Signed in'}</p>
              <p className="text-xs text-slate-500">{user ? ROLE_LABELS[user.role] : 'Inventory workspace'}</p>
            </div>
            <button
              className="mt-1 w-full rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={() => navigate('/profile')}
            >
              Profile
            </button>
            <button
              className="w-full rounded-md px-2 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="button"
              onClick={onLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
