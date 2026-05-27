import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { GuestRoute, ProtectedRoute, RoleProtectedRoute } from './components/ProtectedRoute';
import { ROLES } from './permissions/capabilities';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImportCenterPage } from './pages/ImportCenterPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryTransactionsPage } from './pages/InventoryTransactionsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { SupplierProfilePage } from './pages/SupplierProfilePage';
import { TenantDrilldownPage } from './pages/TenantDrilldownPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { UsersPage } from './pages/UsersPage';
import { WarehousesPage } from './pages/WarehousesPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/app" element={<DashboardPage />} />
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN, ROLES.INVENTORY_MANAGER, ROLES.WAREHOUSE_STAFF, ROLES.AUDITOR, ROLES.PROCUREMENT_MANAGER]} />}>
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:productId" element={<ProductDetailPage />} />
                <Route path="/transactions" element={<InventoryTransactionsPage />} />
                <Route path="/warehouses" element={<WarehousesPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN, ROLES.INVENTORY_MANAGER, ROLES.WAREHOUSE_STAFF]} />}>
                <Route path="/inventory" element={<InventoryPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN]} />}>
                <Route path="/products/new" element={<ProductFormPage />} />
                <Route path="/products/:productId/edit" element={<ProductFormPage />} />
                <Route path="/imports" element={<ImportCenterPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN, ROLES.PROCUREMENT_MANAGER]} />}>
                <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                <Route path="/purchase-orders/:purchaseOrderId" element={<PurchaseOrderDetailPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/suppliers/:supplierId" element={<SupplierProfilePage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
                <Route path="/tenants/:tenantId" element={<TenantDrilldownPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.RETAILER_ADMIN]} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN]} />}>
                <Route path="/approvals" element={<ApprovalsPage />} />
              </Route>
              <Route element={<RoleProtectedRoute allowedRoles={[ROLES.RETAILER_ADMIN, ROLES.AUDITOR]} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
