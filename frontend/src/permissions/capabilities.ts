import type { UserRole } from '../lib/auth-store';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  RETAILER_ADMIN: 'retailer_admin',
  INVENTORY_MANAGER: 'inventory_manager',
  WAREHOUSE_STAFF: 'warehouse_staff',
  AUDITOR: 'auditor',
  PROCUREMENT_MANAGER: 'procurement_manager',
} as const satisfies Record<string, UserRole>;

export const ROLE_LABELS: Record<UserRole, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.RETAILER_ADMIN]: 'Retailer Admin',
  [ROLES.INVENTORY_MANAGER]: 'Inventory Manager',
  [ROLES.WAREHOUSE_STAFF]: 'Warehouse Staff',
  [ROLES.AUDITOR]: 'Auditor',
  [ROLES.PROCUREMENT_MANAGER]: 'Procurement Manager',
};

export function canViewInventoryDashboard(role?: UserRole | null) {
  return (
    role === ROLES.RETAILER_ADMIN ||
    role === ROLES.INVENTORY_MANAGER ||
    role === ROLES.WAREHOUSE_STAFF ||
    role === ROLES.AUDITOR ||
    role === ROLES.PROCUREMENT_MANAGER
  );
}

export function canViewProducts(role?: UserRole | null) {
  return (
    role === ROLES.RETAILER_ADMIN ||
    role === ROLES.INVENTORY_MANAGER ||
    role === ROLES.WAREHOUSE_STAFF ||
    role === ROLES.AUDITOR ||
    role === ROLES.PROCUREMENT_MANAGER
  );
}

export function canManageProducts(role?: UserRole | null) {
  return role === ROLES.RETAILER_ADMIN;
}

export function canManageInventory(role?: UserRole | null) {
  return role === ROLES.RETAILER_ADMIN || role === ROLES.INVENTORY_MANAGER || role === ROLES.WAREHOUSE_STAFF;
}

export function canViewWarehouses(role?: UserRole | null) {
  return (
    role === ROLES.RETAILER_ADMIN ||
    role === ROLES.INVENTORY_MANAGER ||
    role === ROLES.WAREHOUSE_STAFF ||
    role === ROLES.AUDITOR ||
    role === ROLES.PROCUREMENT_MANAGER
  );
}

export function canViewTransactionHistory(role?: UserRole | null) {
  return (
    role === ROLES.RETAILER_ADMIN ||
    role === ROLES.INVENTORY_MANAGER ||
    role === ROLES.WAREHOUSE_STAFF ||
    role === ROLES.AUDITOR ||
    role === ROLES.PROCUREMENT_MANAGER
  );
}

export function canUseWarehouseWorkflow(role?: UserRole | null) {
  return role === ROLES.WAREHOUSE_STAFF;
}

export function canUseAuditorWorkflow(role?: UserRole | null) {
  return role === ROLES.AUDITOR;
}

export function canManageProcurement(role?: UserRole | null) {
  return role === ROLES.RETAILER_ADMIN || role === ROLES.PROCUREMENT_MANAGER;
}

export function canManageUsers(role?: UserRole | null) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.RETAILER_ADMIN;
}

export function canManageApprovals(role?: UserRole | null) {
  return role === ROLES.RETAILER_ADMIN;
}

export function canViewAuditLogs(role?: UserRole | null) {
  return role === ROLES.RETAILER_ADMIN || role === ROLES.AUDITOR;
}

export function canManageTenants(role?: UserRole | null) {
  return role === ROLES.SUPER_ADMIN;
}

export function canViewPlatformAnalytics(role?: UserRole | null) {
  return role === ROLES.SUPER_ADMIN;
}

export function canAccessRoute(pathname: string, role?: UserRole | null) {
  if (pathname === '/app') {
    return canViewPlatformAnalytics(role) || canViewInventoryDashboard(role);
  }
  if (pathname === '/products' || /^\/products\/[^/]+$/.test(pathname)) {
    return canViewProducts(role);
  }
  if (pathname === '/products/new' || /^\/products\/[^/]+\/edit$/.test(pathname)) {
    return canManageProducts(role);
  }
  if (pathname === '/inventory' || pathname === '/transactions') {
    return pathname === '/inventory' ? canManageInventory(role) : canViewTransactionHistory(role);
  }
  if (pathname === '/warehouses') {
    return canViewWarehouses(role);
  }
  if (pathname === '/imports') {
    return role === ROLES.RETAILER_ADMIN;
  }
  if (pathname === '/purchase-orders' || /^\/purchase-orders\/[^/]+$/.test(pathname)) {
    return canManageProcurement(role);
  }
  if (pathname === '/suppliers' || /^\/suppliers\/[^/]+$/.test(pathname)) {
    return canManageProcurement(role);
  }
  if (pathname === '/users') {
    return canManageUsers(role);
  }
  if (pathname === '/approvals') {
    return canManageApprovals(role);
  }
  if (pathname === '/audit-logs') {
    return canViewAuditLogs(role);
  }
  if (/^\/tenants\/[^/]+$/.test(pathname)) {
    return canManageTenants(role);
  }
  return false;
}
