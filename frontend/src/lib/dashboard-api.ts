import { api, type ApiEnvelope } from './api';

export type MovementSummary = {
  stock_in: number;
  stock_out: number;
  adjustment: number;
};

export type CategoryStat = {
  category: string;
  product_count: number;
  total_quantity: number;
};

export type RecentTransaction = {
  id: string;
  product_id: string;
  product_name: string;
  transaction_type: 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string | null;
  created_at: string;
};

export type ScanActivity = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  code: string;
  source: string;
  created_at: string;
};

export type WarehouseInventoryItem = {
  id: string;
  product_name: string;
  sku: string;
  quantity: number;
  warehouse_location?: string | null;
  stock_status: 'available' | 'low_stock' | 'out_of_stock';
};

export type WarehouseStaffDashboard = {
  assigned_warehouse?: string | null;
  pending_receipts: number;
  pending_dispatches: number;
  todays_movements: number;
  low_stock_alerts: number;
  recent_scans: number;
  transfer_requests: number;
  daily_stock_in: number;
  daily_stock_out: number;
  inventory_items: WarehouseInventoryItem[];
  recent_transactions: RecentTransaction[];
  scan_activity: ScanActivity[];
  pending_transfer_requests: number;
};

export type AuditorWarehouseActivity = {
  warehouse_location: string;
  transaction_count: number;
  stock_in: number;
  stock_out: number;
  adjustments: number;
};

export type AuditorActiveUser = {
  user_id?: string | null;
  user_name: string;
  activity_count: number;
  last_activity_at?: string | null;
};

export type AuditorFlag = {
  id: string;
  product_name: string;
  transaction_type: InventoryTransactionLabel;
  quantity: number;
  notes?: string | null;
  created_at: string;
  reason: string;
};

type InventoryTransactionLabel = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export type AuditorDashboard = {
  total_inventory_units: number;
  total_products: number;
  transaction_volume: number;
  suspicious_adjustments: number;
  low_stock_items: number;
  recent_activities: RecentTransaction[];
  warehouse_activity: AuditorWarehouseActivity[];
  most_active_users: AuditorActiveUser[];
  suspicious_flags: AuditorFlag[];
  movement_summary: MovementSummary;
  activity_trends: ActivityTrend[];
};

export type ProcurementReorderRecommendation = {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  recommended_quantity: number;
  warehouse_location?: string | null;
};

export type ProcurementDashboard = {
  pending_purchase_orders: number;
  supplier_performance: SupplierActivity[];
  incoming_shipments: number;
  low_stock_products: number;
  reorder_recommendations: ProcurementReorderRecommendation[];
  delayed_deliveries: number;
  monthly_purchase_total: number;
  monthly_received_units: number;
  recent_purchase_orders: Array<{
    id: string;
    po_number: string;
    supplier_name: string;
    status: string;
    expected_delivery_date?: string | null;
    created_at: string;
  }>;
};

export type SupplierActivity = {
  supplier_name: string;
  purchase_order_count: number;
  units_received: number;
};

export type WarehousePerformance = {
  warehouse_id: string;
  name: string;
  code: string;
  product_count: number;
  total_units: number;
  low_stock_items: number;
};

export type RetailerDashboard = {
  total_products: number;
  low_stock_products: number;
  total_inventory_quantity: number;
  total_suppliers: number;
  total_purchase_orders: number;
  pending_purchase_orders: number;
  completed_purchase_orders: number;
  movement_summary: MovementSummary;
  category_stats: CategoryStat[];
  recent_transactions: RecentTransaction[];
  supplier_activity: SupplierActivity[];
  total_warehouses: number;
  pending_transfer_requests: number;
  warehouse_performance: WarehousePerformance[];
  recent_scans: number;
  scan_activity: ScanActivity[];
  pending_approvals: number;
};

export type TenantSummary = {
  tenant_id: string;
  company_name: string;
  active_users: number;
  product_count: number;
  inventory_units: number;
  last_activity_at?: string | null;
  status: string;
};

export type TenantActivitySummary = {
  tenant_id: string;
  company_name: string;
  activity_count: number;
  last_activity_at?: string | null;
  status: string;
};

export type PlatformUsage = {
  tenants_with_products: number;
  tenants_with_recent_activity: number;
  average_products_per_tenant: number;
  low_stock_tenant_count: number;
};

export type ActivityTrend = {
  period: string;
  transaction_count: number;
  units_moved: number;
};

export type AdminDashboard = {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_products: number;
  total_inventory_quantity: number;
  total_suppliers: number;
  total_purchase_orders: number;
  pending_purchase_orders: number;
  completed_purchase_orders: number;
  low_stock_tenant_count: number;
  movement_summary: MovementSummary;
  platform_usage: PlatformUsage;
  tenant_summaries: TenantSummary[];
  recent_tenant_activity: TenantActivitySummary[];
};

export type AdminTenantDrilldown = {
  tenant: TenantSummary;
  movement_summary: MovementSummary;
  low_stock_products: number;
  category_stats: CategoryStat[];
  activity_trends: ActivityTrend[];
};

export async function getRetailerDashboard() {
  const response = await api.get<ApiEnvelope<RetailerDashboard>>('/dashboard/retailer');
  if (!response.data.data) {
    throw new Error('Retailer dashboard response did not include data.');
  }
  return response.data.data;
}

export async function getWarehouseStaffDashboard() {
  const response = await api.get<ApiEnvelope<WarehouseStaffDashboard>>('/dashboard/warehouse-staff');
  if (!response.data.data) {
    throw new Error('Warehouse dashboard response did not include data.');
  }
  return response.data.data;
}

export async function getAuditorDashboard() {
  const response = await api.get<ApiEnvelope<AuditorDashboard>>('/dashboard/auditor');
  if (!response.data.data) {
    throw new Error('Auditor dashboard response did not include data.');
  }
  return response.data.data;
}

export async function getProcurementDashboard() {
  const response = await api.get<ApiEnvelope<ProcurementDashboard>>('/dashboard/procurement');
  if (!response.data.data) {
    throw new Error('Procurement dashboard response did not include data.');
  }
  return response.data.data;
}

export async function getAdminDashboard() {
  const response = await api.get<ApiEnvelope<AdminDashboard>>('/dashboard/admin');
  if (!response.data.data) {
    throw new Error('Admin dashboard response did not include data.');
  }
  return response.data.data;
}

export async function getAdminTenantDrilldown(tenantId: string) {
  const response = await api.get<ApiEnvelope<AdminTenantDrilldown>>(`/dashboard/admin/tenants/${tenantId}`);
  if (!response.data.data) {
    throw new Error('Tenant analytics response did not include data.');
  }
  return response.data.data;
}
