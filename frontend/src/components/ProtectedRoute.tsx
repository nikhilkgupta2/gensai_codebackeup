import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { fetchCurrentUser } from '../lib/auth-api';
import { isTokenExpired } from '../lib/auth-token';
import { useAuthStore, type UserRole } from '../lib/auth-store';

type ProtectedRouteProps = {
  children?: ReactNode;
};

function ProtectedLoadingState() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-slate-600">
      Loading workspace...
    </main>
  );
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const tokenExpired = isTokenExpired(token);
  const currentUserQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    enabled: Boolean(token) && !tokenExpired,
    retry: false,
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      setUser(currentUserQuery.data);
    }
  }, [currentUserQuery.data, setUser]);

  useEffect(() => {
    if (tokenExpired) {
      clearSession();
    }
  }, [clearSession, tokenExpired]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (tokenExpired) {
    return <Navigate to="/login" replace state={{ from: location, sessionExpired: true }} />;
  }

  if (currentUserQuery.isLoading) {
    return <ProtectedLoadingState />;
  }

  if (currentUserQuery.data && (!user || user.id !== currentUserQuery.data.id)) {
    return <ProtectedLoadingState />;
  }

  if (currentUserQuery.isError) {
    clearSession();
    return <Navigate to="/login" replace state={{ from: location, sessionExpired: true }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

type RoleProtectedRouteProps = ProtectedRouteProps & {
  allowedRoles: UserRole[];
};

export function RoleProtectedRoute({ allowedRoles, children }: RoleProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace state={{ from: location }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function GuestRoute({ children }: ProtectedRouteProps) {
  const token = useAuthStore((state) => state.token);
  const clearSession = useAuthStore((state) => state.clearSession);
  const tokenExpired = isTokenExpired(token);

  useEffect(() => {
    if (tokenExpired) {
      clearSession();
    }
  }, [clearSession, tokenExpired]);

  if (token && !tokenExpired) {
    return <Navigate to="/app" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
