import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../lib/auth-store';
import { ContentLayout, ScrollableContent } from './ContentLayout';
import { SidebarLayout } from './SidebarLayout';
import { TopbarLayout } from './TopbarLayout';

const SIDEBAR_STORAGE_KEY = 'ims-sidebar-collapsed';

export function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
      <div className="h-screen overflow-hidden bg-slate-100 text-slate-950 dark:bg-[#242424] dark:text-white">
      <SidebarLayout
        role={user?.role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <ContentLayout collapsed={collapsed}>
        <TopbarLayout
          user={user}
          onOpenMobile={() => setMobileOpen(true)}
          onLogout={() => {
            clearSession();
            navigate('/login');
          }}
        />
        <ScrollableContent>
          <Outlet />
        </ScrollableContent>
      </ContentLayout>
    </div>
  );
}
