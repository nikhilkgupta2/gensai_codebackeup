import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  Barcode,
  Boxes,
  Building2,
  ClipboardList,
  PackageCheck,
  PackageSearch,
  Printer,
  ScanLine,
  Search,
  ShieldCheck,
  Truck,
  UploadCloud,
  Users,
} from 'lucide-react';

import {
  DonutChartCard,
  HorizontalBarChartCard,
  LineChartCard,
  MovementTrendChart,
  VerticalBarChartCard,
} from '../components/dashboard/DashboardCharts';
import { ActivityFeedPanel } from '../components/notifications/ActivityFeedPanel';
import {
  getAdminDashboard,
  getAuditorDashboard,
  getProcurementDashboard,
  getRetailerDashboard,
  getWarehouseStaffDashboard,
  type AdminDashboard,
  type AuditorDashboard,
  type MovementSummary,
  type ProcurementDashboard,
  type RecentTransaction,
  type RetailerDashboard,
  type ScanActivity,
  type SupplierActivity,
  type TenantActivitySummary,
  type WarehouseStaffDashboard,
} from '../lib/dashboard-api';
import { useAuthStore } from '../lib/auth-store';
import {
  canManageProcurement,
  canUseAuditorWorkflow,
  canUseWarehouseWorkflow,
  canViewPlatformAnalytics,
  ROLES,
} from '../permissions/capabilities';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { StatWidget } from '../components/ui/StatWidget';
import { listProducts, type Product } from '../lib/product-api';

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Boxes }) {
  return <StatWidget title={title} value={value.toLocaleString()} icon={Icon} />;
}

function MovementWidget({ summary }: { summary: MovementSummary }) {
  const items = [
    ['Stock in', summary.stock_in],
    ['Stock out', summary.stock_out],
    ['Adjustments', summary.adjustment],
  ] as const;
  const max = Math.max(1, ...items.map(([, value]) => Math.abs(value)));

  return (
    <SectionCard>
      <SectionHeader title="Inventory movement" description="Current period movement volume by transaction type." />
      <div className="space-y-4 p-5">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">{label}</span>
              <span className="text-slate-500">{value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-slate-900"
                style={{ width: `${Math.max(6, (Math.abs(value) / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function formatNullableDate(value?: string | null) {
  if (!value) {
    return 'No activity';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function buildMovementTrend(transactions: RecentTransaction[]) {
  const grouped = new Map<string, { period: string; stockIn: number; stockOut: number }>();
  transactions.forEach((transaction) => {
    const key = transaction.created_at.slice(0, 10);
    const current = grouped.get(key) ?? { period: formatPeriod(transaction.created_at), stockIn: 0, stockOut: 0 };
    if (transaction.transaction_type === 'STOCK_IN') {
      current.stockIn += transaction.quantity;
    }
    if (transaction.transaction_type === 'STOCK_OUT') {
      current.stockOut += Math.abs(transaction.quantity);
    }
    grouped.set(key, current);
  });
  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function buildLowStockData(products: Product[]) {
  return products
    .filter((product) => product.quantity <= 10)
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 8)
    .map((product) => ({
      label: product.product_name.length > 18 ? `${product.product_name.slice(0, 18)}...` : product.product_name,
      units: Math.max(product.quantity, 0),
    }));
}

function buildInventoryValueData(products: Product[]) {
  const grouped = new Map<string, number>();
  products.forEach((product) => {
    const category = product.category || 'Uncategorized';
    grouped.set(category, (grouped.get(category) ?? 0) + product.quantity * (product.price ?? 0));
  });
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function PlatformActivityWidget({ summary }: { summary: MovementSummary }) {
  const totalMovements = summary.stock_in + summary.stock_out + Math.abs(summary.adjustment);
  const items = [
    ['Inbound units', summary.stock_in],
    ['Outbound units', summary.stock_out],
    ['Adjustment volume', Math.abs(summary.adjustment)],
  ] as const;
  const max = Math.max(1, ...items.map(([, value]) => value));

  return (
    <SectionCard>
      <SectionHeader
        title="Platform activity volume"
        description="Aggregate movement totals only. No product, SKU, or transaction detail."
        actions={<ShieldCheck className="h-5 w-5 text-slate-400" />}
      />
      <div className="p-5">
        <p className="text-2xl font-semibold">{totalMovements.toLocaleString()}</p>
        <div className="mt-4 space-y-4">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">{label}</span>
              <span className="text-slate-500">{value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.max(6, (value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
        </div>
      </div>
    </SectionCard>
  );
}

function RecentActivity({ transactions }: { transactions: RecentTransaction[] }) {
  return (
    <SectionCard>
      <SectionHeader title="Recent activity" description="Latest stock updates for this tenant." />
      {transactions.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No inventory activity yet" description="Stock movements will appear here after inventory updates are recorded." />
        </div>
      ) : (
        <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
          <DataTableHeader>
            <tr>
              <DataTableHead>Product</DataTableHead>
              <DataTableHead>Type</DataTableHead>
              <DataTableHead className="text-right">Qty</DataTableHead>
              <DataTableHead>Time</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
              {transactions.map((transaction) => (
                <DataTableRow key={transaction.id}>
                  <DataTableCell className="font-medium text-slate-900">{transaction.product_name}</DataTableCell>
                  <DataTableCell>{transaction.transaction_type.replace('_', ' ')}</DataTableCell>
                  <DataTableCell className="text-right font-medium text-slate-900">{transaction.quantity}</DataTableCell>
                  <DataTableCell>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(transaction.created_at))}
                  </DataTableCell>
                </DataTableRow>
              ))}
          </DataTableBody>
        </DataTable>
      )}
    </SectionCard>
  );
}

function ScanActivityFeed({ scans }: { scans: ScanActivity[] }) {
  return (
    <SectionCard>
      <SectionHeader title="Scan activity" description="Recent barcode and QR lookups recorded by operational users." />
      {scans.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No scans yet" description="Product scans will appear here after scanner workflows are used." />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {scans.map((scan) => (
            <div key={scan.id} className="flex min-w-0 gap-3 px-4 py-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                <ScanLine className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{scan.product_name}</p>
                  <Badge tone="blue">{scan.source}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">{scan.sku}</p>
                <p className="mt-1 text-xs text-slate-500">{formatNullableDate(scan.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SupplierActivityWidget({ activity }: { activity: SupplierActivity[] }) {
  return (
    <SectionCard>
      <SectionHeader title="Supplier activity" description="Procurement volume by supplier." />
      {activity.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No supplier activity yet" description="Supplier ordering activity will appear after purchase orders are created." />
        </div>
      ) : (
        <div className="space-y-3 p-5">
          {activity.map((supplier) => (
            <div key={supplier.supplier_name} className="rounded-md border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{supplier.supplier_name}</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                  {supplier.purchase_order_count} POs
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {supplier.units_received.toLocaleString()} units received
              </p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function RecentTenantActivity({ activity }: { activity: TenantActivitySummary[] }) {
  return (
    <SectionCard>
      <SectionHeader title="Recent tenant activity" description="Tenant-level summaries for compliance monitoring." />
      {activity.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No tenant activity yet" description="Recent tenant movement summaries will appear here." />
        </div>
      ) : (
        <div className="space-y-3 p-5">
          {activity.map((tenant) => (
            <Link
              key={tenant.tenant_id}
              to={`/tenants/${tenant.tenant_id}`}
              className="block rounded-md border border-slate-200 p-3 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium text-slate-900">{tenant.company_name}</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium capitalize text-slate-600">
                  {tenant.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {tenant.activity_count.toLocaleString()} aggregate events · {formatNullableDate(tenant.last_activity_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function InventoryOperationsDashboardView({
  dashboard,
  showProcurementWidgets,
  products,
  productsLoading,
  canImportStarterData,
}: {
  dashboard: RetailerDashboard;
  showProcurementWidgets: boolean;
  products: Product[];
  productsLoading: boolean;
  canImportStarterData: boolean;
}) {
  const categoryDistribution = dashboard.category_stats.map((category) => ({
    label: category.category || 'Uncategorized',
    products: category.product_count,
  }));
  const movementTrend = buildMovementTrend(dashboard.recent_transactions);
  const lowStockData = buildLowStockData(products);
  const inventoryValueData = buildInventoryValueData(products);

  return (
    <>
      {dashboard.total_products === 0 && canImportStarterData ? (
        <SectionCard className="mb-4 border-slate-300 bg-slate-50">
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-950 text-white">
                <UploadCloud className="h-5 w-5" />
              </span>
              <div>
                <p className="text-base font-semibold text-slate-950">Start with a CSV import</p>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Upload products, suppliers, and warehouse stock from vetted templates to populate this workspace quickly.
                </p>
              </div>
            </div>
            <Link
              to="/imports"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Open Import Center
            </Link>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total products" value={dashboard.total_products} icon={Boxes} />
        <StatCard title="Low-stock products" value={dashboard.low_stock_products} icon={AlertCircle} />
        <StatCard title="Inventory quantity" value={dashboard.total_inventory_quantity} icon={PackageCheck} />
        <StatCard title="Warehouses" value={dashboard.total_warehouses} icon={Building2} />
        <StatCard title="Transfer requests" value={dashboard.pending_transfer_requests} icon={ArrowRightLeft} />
        <StatCard title="Pending approvals" value={dashboard.pending_approvals} icon={ShieldCheck} />
        {showProcurementWidgets ? (
          <>
            <StatCard title="Suppliers" value={dashboard.total_suppliers} icon={Truck} />
          </>
        ) : (
          <>
            <StatCard title="Stock in units" value={dashboard.movement_summary.stock_in} icon={Activity} />
            <StatCard title="Stock out units" value={dashboard.movement_summary.stock_out} icon={Activity} />
            <StatCard title="Adjustments" value={Math.abs(dashboard.movement_summary.adjustment)} icon={ClipboardList} />
            <StatCard title="Scans today" value={dashboard.recent_scans} icon={ScanLine} />
          </>
        )}
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <DonutChartCard
          title="Inventory category distribution"
          description="Category-wise product distribution for this tenant."
          data={categoryDistribution}
          dataKey="products"
          nameKey="label"
        />
        <MovementTrendChart
          title="Stock movement trend"
          description="Recent stock-in and stock-out volume from tenant movement history."
          data={movementTrend}
        />
        {productsLoading ? (
          <SectionCard className="min-w-0">
            <SectionHeader title="Low stock alerts" description="Products closest to depletion." />
            <div className="p-5">
              <LoadingState label="Loading stock alert analytics..." />
            </div>
          </SectionCard>
        ) : (
          <HorizontalBarChartCard
            title="Low stock alerts"
            description="Products nearest to depletion based on current tenant stock."
            data={lowStockData}
            dataKey="units"
            nameKey="label"
          />
        )}
        {productsLoading ? (
          <SectionCard className="min-w-0">
            <SectionHeader title="Inventory value by category" description="Current valuation grouped by product category." />
            <div className="p-5">
              <LoadingState label="Loading inventory valuation..." />
            </div>
          </SectionCard>
        ) : (
          <HorizontalBarChartCard
            title="Inventory value by category"
            description="Current on-hand value using product price and quantity."
            data={inventoryValueData}
            dataKey="value"
            nameKey="label"
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,420px)_1fr]">
        <MovementWidget summary={dashboard.movement_summary} />
        <SectionCard>
          <SectionHeader title="Category summary" description="Product count and unit depth by category." />
          {dashboard.category_stats.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No category data yet" description="Categorized product inventory will appear here." />
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {dashboard.category_stats.map((category) => (
                <div key={category.category} className="rounded-md border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{category.category}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {category.product_count} products · {category.total_quantity} units
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
      <SectionCard className="mt-4">
        <SectionHeader title="Warehouse performance" description="Warehouse-level stock depth, product count, and low-stock pressure." />
        {dashboard.warehouse_performance.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No warehouse data yet" description="Warehouse inventory appears after locations are created or stocked." />
          </div>
        ) : (
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.warehouse_performance.map((warehouse) => (
              <div key={warehouse.warehouse_id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{warehouse.name}</p>
                    <p className="text-xs text-slate-500">{warehouse.code}</p>
                  </div>
                  <Badge tone={warehouse.low_stock_items > 0 ? 'amber' : 'green'}>{warehouse.total_units.toLocaleString()} units</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">{warehouse.product_count} products · {warehouse.low_stock_items} low-stock</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      {showProcurementWidgets ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,420px)_1fr]">
          <SupplierActivityWidget activity={dashboard.supplier_activity} />
          <RecentActivity transactions={dashboard.recent_transactions} />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px]">
          <RecentActivity transactions={dashboard.recent_transactions} />
          <ScanActivityFeed scans={dashboard.scan_activity} />
        </div>
      )}
    </>
  );
}

function AdminDashboardView({ dashboard }: { dashboard: AdminDashboard }) {
  const tenantHealthData = dashboard.tenant_summaries.slice(0, 8).map((tenant) => ({
    label: tenant.company_name.length > 14 ? `${tenant.company_name.slice(0, 14)}...` : tenant.company_name,
    users: tenant.active_users,
    products: tenant.product_count,
  }));
  const usageData = [
    { label: 'With products', value: dashboard.platform_usage.tenants_with_products },
    { label: 'Recently active', value: dashboard.platform_usage.tenants_with_recent_activity },
    { label: 'Low stock', value: dashboard.platform_usage.low_stock_tenant_count },
  ].filter((item) => item.value > 0);
  const tenantActivityTrend = dashboard.recent_tenant_activity
    .slice()
    .sort((a, b) => (a.last_activity_at ?? '').localeCompare(b.last_activity_at ?? ''))
    .map((tenant) => ({
      period: tenant.company_name.length > 10 ? `${tenant.company_name.slice(0, 10)}...` : tenant.company_name,
      events: tenant.activity_count,
      units: 0,
    }));

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        <StatCard title="Tenants" value={dashboard.total_tenants} icon={Building2} />
        <StatCard title="Active tenants" value={dashboard.active_tenants} icon={PackageCheck} />
        <StatCard title="Users" value={dashboard.total_users} icon={Users} />
        <StatCard title="Products" value={dashboard.total_products} icon={Boxes} />
        <StatCard title="Inventory units" value={dashboard.total_inventory_quantity} icon={Activity} />
        <StatCard title="Suppliers" value={dashboard.total_suppliers} icon={Truck} />
        <StatCard title="Purchase orders" value={dashboard.total_purchase_orders} icon={ClipboardList} />
        <StatCard title="Completed orders" value={dashboard.completed_purchase_orders} icon={PackageCheck} />
        <StatCard title="Low-stock tenants" value={dashboard.low_stock_tenant_count} icon={AlertCircle} />
        <StatCard title="Tenants with products" value={dashboard.platform_usage.tenants_with_products} icon={Building2} />
        <StatCard title="Recently active tenants" value={dashboard.platform_usage.tenants_with_recent_activity} icon={ShieldCheck} />
      </div>
      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-3">
        <VerticalBarChartCard
          title="Tenant operational footprint"
          description="Aggregate product and user counts by tenant. No SKU or transaction detail."
          data={tenantHealthData}
          bars={[
            { key: 'products', name: 'Products', color: '#0f172a' },
            { key: 'users', name: 'Active users', color: '#2563eb' },
          ]}
        />
        <DonutChartCard
          title="Platform usage mix"
          description="Aggregate tenant adoption and health signals."
          data={usageData}
          dataKey="value"
          nameKey="label"
        />
        <LineChartCard
          title="Tenant activity intensity"
          description="Recent tenant-level activity counts for platform monitoring."
          data={tenantActivityTrend}
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,420px)_1fr]">
        <PlatformActivityWidget summary={dashboard.movement_summary} />
        <SectionCard>
          <SectionHeader
            title="Tenant summary"
            description="Read-only aggregate health across retailers."
            actions={
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
              Avg {dashboard.platform_usage.average_products_per_tenant.toLocaleString()} products / tenant
            </span>
            }
          />
          {dashboard.tenant_summaries.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No tenants found" description="Tenant summaries will populate when retailers are onboarded." />
            </div>
          ) : (
            <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
                <DataTableHeader>
                  <tr>
                    <DataTableHead>Tenant</DataTableHead>
                    <DataTableHead>Active users</DataTableHead>
                    <DataTableHead>Products</DataTableHead>
                    <DataTableHead>Units</DataTableHead>
                    <DataTableHead>Last activity</DataTableHead>
                    <DataTableHead>Status</DataTableHead>
                  </tr>
                </DataTableHeader>
                <DataTableBody>
                  {dashboard.tenant_summaries.map((tenant) => (
                    <DataTableRow key={tenant.tenant_id}>
                      <DataTableCell>
                        <Link to={`/tenants/${tenant.tenant_id}`} className="font-medium text-slate-900 underline-offset-4 hover:underline">
                          {tenant.company_name}
                        </Link>
                      </DataTableCell>
                      <DataTableCell>{tenant.active_users}</DataTableCell>
                      <DataTableCell>{tenant.product_count}</DataTableCell>
                      <DataTableCell className="font-medium text-slate-900">{tenant.inventory_units}</DataTableCell>
                      <DataTableCell>{formatNullableDate(tenant.last_activity_at)}</DataTableCell>
                      <DataTableCell>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium capitalize text-slate-600">
                          {tenant.status}
                        </span>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
          )}
        </SectionCard>
      </div>
      <div className="mt-4">
        <RecentTenantActivity activity={dashboard.recent_tenant_activity} />
      </div>
    </>
  );
}

function WarehouseStaffDashboardView({ dashboard }: { dashboard: WarehouseStaffDashboard }) {
  const quickActions = [
    { label: 'Stock In', to: '/inventory', icon: ArrowUpCircle },
    { label: 'Stock Out', to: '/inventory', icon: ArrowDownCircle },
    { label: 'Transfer Stock', to: '/inventory', icon: Truck },
    { label: 'Scan Barcode', to: '/inventory', icon: Barcode },
    { label: 'Print Label', to: '/inventory', icon: Printer },
    { label: 'Report Damaged Item', to: '/inventory', icon: AlertCircle },
  ];

  return (
    <>
      {!dashboard.assigned_warehouse ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Your account is not assigned to a warehouse yet. Ask a Retailer Admin to set your assigned warehouse before moving stock.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatWidget title="Pending receipts" value={dashboard.pending_receipts.toLocaleString()} icon={PackageCheck} />
        <StatWidget title="Pending dispatches" value={dashboard.pending_dispatches.toLocaleString()} icon={Truck} />
        <StatWidget title="Today's movements" value={dashboard.todays_movements.toLocaleString()} icon={Activity} />
        <StatWidget title="Low stock alerts" value={dashboard.low_stock_alerts.toLocaleString()} icon={AlertCircle} />
        <StatWidget title="Assigned warehouse" value={dashboard.assigned_warehouse ?? 'Unassigned'} icon={Building2} />
        <StatWidget title="Recent scans" value={dashboard.recent_scans.toLocaleString()} icon={ScanLine} />
        <StatWidget title="Transfer requests" value={dashboard.transfer_requests.toLocaleString()} icon={ClipboardList} />
        <StatWidget
          title="Daily activity"
          value={`${dashboard.daily_stock_in.toLocaleString()} in / ${dashboard.daily_stock_out.toLocaleString()} out`}
          icon={PackageSearch}
        />
      </div>

      <SectionCard className="mt-4">
        <SectionHeader title="Quick actions" description="Fast warehouse workflows for tablet and scanner-driven work." />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                to={action.to}
                className="flex min-h-24 flex-col justify-between rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Icon className="h-5 w-5 text-slate-500" />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <SectionCard className="min-w-0">
          <SectionHeader
            title="Assigned warehouse stock"
            description="Operational stock view scoped to your warehouse assignment. Pricing and revenue data are hidden."
          />
          {dashboard.inventory_items.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No assigned stock" description="Stock appears here when products are assigned to your warehouse." />
            </div>
          ) : (
            <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTableHeader>
                <tr>
                  <DataTableHead>Product</DataTableHead>
                  <DataTableHead>SKU</DataTableHead>
                  <DataTableHead className="text-right">Quantity</DataTableHead>
                  <DataTableHead>Location</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {dashboard.inventory_items.map((item) => (
                  <DataTableRow key={item.id}>
                    <DataTableCell className="font-medium text-slate-900">{item.product_name}</DataTableCell>
                    <DataTableCell>{item.sku}</DataTableCell>
                    <DataTableCell className="text-right font-semibold text-slate-900">{item.quantity.toLocaleString()}</DataTableCell>
                    <DataTableCell>{item.warehouse_location ?? 'Unassigned'}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={item.stock_status === 'out_of_stock' ? 'red' : item.stock_status === 'low_stock' ? 'amber' : 'green'}>
                        {item.stock_status.replace('_', ' ')}
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </SectionCard>

        <div className="grid gap-4">
          <RecentActivity transactions={dashboard.recent_transactions} />
          <ScanActivityFeed scans={dashboard.scan_activity} />
        </div>
      </div>
    </>
  );
}

function AuditorDashboardView({ dashboard }: { dashboard: AuditorDashboard }) {
  const movementTrend = dashboard.activity_trends.map((item) => ({
    period: formatPeriod(item.period),
    stockIn: item.units_moved,
    stockOut: item.transaction_count,
  }));
  const warehouseData = dashboard.warehouse_activity.map((warehouse) => ({
    label:
      warehouse.warehouse_location.length > 16
        ? `${warehouse.warehouse_location.slice(0, 16)}...`
        : warehouse.warehouse_location,
    movements: warehouse.transaction_count,
    adjustments: warehouse.adjustments,
  }));

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatWidget title="Total inventory units" value={dashboard.total_inventory_units.toLocaleString()} icon={PackageCheck} />
        <StatWidget title="Total products" value={dashboard.total_products.toLocaleString()} icon={Boxes} />
        <StatWidget title="Transaction volume" value={dashboard.transaction_volume.toLocaleString()} icon={Activity} />
        <StatWidget title="Suspicious adjustments" value={dashboard.suspicious_adjustments.toLocaleString()} icon={AlertCircle} tone="warning" />
        <StatWidget title="Low stock items" value={dashboard.low_stock_items.toLocaleString()} icon={PackageSearch} />
        <StatWidget title="Recent activities" value={dashboard.recent_activities.length.toLocaleString()} icon={ClipboardList} />
        <StatWidget title="Warehouses reviewed" value={dashboard.warehouse_activity.length.toLocaleString()} icon={Building2} />
        <StatWidget title="Active operators" value={dashboard.most_active_users.length.toLocaleString()} icon={Users} />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <MovementTrendChart
          title="Movement review trend"
          description="Read-only transaction and movement volume for compliance review."
          data={movementTrend}
        />
        <VerticalBarChartCard
          title="Warehouse activity summary"
          description="Transaction counts and adjustment activity by warehouse."
          data={warehouseData}
          bars={[
            { key: 'movements', name: 'Movements', color: '#0f172a' },
            { key: 'adjustments', name: 'Adjustments', color: '#d97706' },
          ]}
        />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="min-w-0">
          <SectionHeader
            title="Immutable audit timeline"
            description="Recent stock activity for compliance inspection. No edit or mutation actions are available."
          />
          {dashboard.recent_activities.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No audit activity" description="Inventory activity will appear here after stock movements occur." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard.recent_activities.map((activity) => (
                <div key={activity.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                    <Search className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={activity.transaction_type === 'STOCK_OUT' ? 'red' : activity.transaction_type === 'ADJUSTMENT' ? 'amber' : 'green'}>
                        {activity.transaction_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm font-semibold text-slate-900">{activity.quantity.toLocaleString()} units</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-700">{activity.product_name}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatNullableDate(activity.created_at)}</p>
                    {activity.notes ? <p className="mt-1 text-xs text-slate-500">Notes: {activity.notes}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="min-w-0">
          <SectionHeader title="Security monitoring flags" description="Large adjustments and excessive stock removals." />
          {dashboard.suspicious_flags.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No suspicious activity" description="Large adjustments and stock removals will be flagged here." />
            </div>
          ) : (
            <div className="space-y-3 p-5">
              {dashboard.suspicious_flags.map((flag) => (
                <div key={flag.id} className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{flag.product_name}</p>
                    <Badge tone="amber">{flag.reason}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {flag.transaction_type.replace('_', ' ')} · {flag.quantity.toLocaleString()} units
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatNullableDate(flag.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <SectionCard className="min-w-0">
          <SectionHeader title="Most active users" description="Users with the most recorded inventory operations." />
          {dashboard.most_active_users.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No user activity" description="User activity appears here after inventory operations are recorded." />
            </div>
          ) : (
            <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTableHeader>
                <tr>
                  <DataTableHead>User</DataTableHead>
                  <DataTableHead className="text-right">Events</DataTableHead>
                  <DataTableHead>Last activity</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {dashboard.most_active_users.map((user) => (
                  <DataTableRow key={user.user_id ?? user.user_name}>
                    <DataTableCell className="font-medium text-slate-900">{user.user_name}</DataTableCell>
                    <DataTableCell className="text-right">{user.activity_count.toLocaleString()}</DataTableCell>
                    <DataTableCell>{formatNullableDate(user.last_activity_at)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </SectionCard>

        <SectionCard className="min-w-0">
          <SectionHeader title="Compliance report shortcuts" description="Read-only reports available to export from Products and Transactions." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              'Inventory movement summary',
              'Warehouse activity report',
              'User activity report',
              'Stock discrepancy report',
            ].map((report) => (
              <Link
                key={report}
                to={report.includes('Inventory') ? '/transactions' : '/products'}
                className="rounded-md border border-slate-200 p-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                {report}
                <span className="mt-1 block text-xs font-normal text-slate-500">CSV export ready</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function ProcurementDashboardView({ dashboard }: { dashboard: ProcurementDashboard }) {
  const supplierData = dashboard.supplier_performance.map((supplier) => ({
    label: supplier.supplier_name.length > 14 ? `${supplier.supplier_name.slice(0, 14)}...` : supplier.supplier_name,
    orders: supplier.purchase_order_count,
    units: supplier.units_received,
  }));

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatWidget title="Pending purchase orders" value={dashboard.pending_purchase_orders.toLocaleString()} icon={ClipboardList} tone="warning" />
        <StatWidget title="Incoming shipments" value={dashboard.incoming_shipments.toLocaleString()} icon={Truck} />
        <StatWidget title="Low stock products" value={dashboard.low_stock_products.toLocaleString()} icon={AlertCircle} tone="warning" />
        <StatWidget title="Delayed deliveries" value={dashboard.delayed_deliveries.toLocaleString()} icon={PackageSearch} tone="warning" />
        <StatWidget title="Monthly purchasing" value={`$${dashboard.monthly_purchase_total.toLocaleString()}`} icon={Activity} />
        <StatWidget title="Received this month" value={dashboard.monthly_received_units.toLocaleString()} icon={PackageCheck} />
        <StatWidget title="Reorder suggestions" value={dashboard.reorder_recommendations.length.toLocaleString()} icon={Boxes} />
        <StatWidget title="Supplier performance" value={dashboard.supplier_performance.length.toLocaleString()} icon={Users} />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
        <VerticalBarChartCard
          title="Top supplier activity"
          description="Purchase order count and received units by supplier."
          data={supplierData}
          bars={[
            { key: 'orders', name: 'Orders', color: '#0f172a' },
            { key: 'units', name: 'Units received', color: '#2563eb' },
          ]}
        />
        <SectionCard className="min-w-0">
          <SectionHeader
            title="Reorder recommendations"
            description="Suggested replenishment based on low current stock."
            actions={
              <Link to="/purchase-orders" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
                Create PO
              </Link>
            }
          />
          {dashboard.reorder_recommendations.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No reorder recommendations" description="Low-stock products will appear here when replenishment is needed." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {dashboard.reorder_recommendations.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{item.product_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.sku} · {item.warehouse_location ?? 'Unassigned'} · {item.quantity} on hand
                    </p>
                  </div>
                  <Badge tone="amber">Order {item.recommended_quantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard className="min-w-0">
          <SectionHeader title="Incoming shipment tracker" description="Recent purchase orders by supplier, status, and expected delivery." />
          {dashboard.recent_purchase_orders.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No purchase orders yet" description="Procurement orders will appear here after creation." />
            </div>
          ) : (
            <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTableHeader>
                <tr>
                  <DataTableHead>PO</DataTableHead>
                  <DataTableHead>Supplier</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Expected</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {dashboard.recent_purchase_orders.map((order) => (
                  <DataTableRow key={order.id}>
                    <DataTableCell>
                      <Link to={`/purchase-orders/${order.id}`} className="font-semibold text-slate-900 underline-offset-4 hover:underline">
                        {order.po_number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{order.supplier_name}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={order.status === 'cancelled' ? 'red' : order.status === 'completed' ? 'green' : 'blue'}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>{order.expected_delivery_date ?? 'Not set'}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </SectionCard>

        <SectionCard className="min-w-0">
          <SectionHeader title="Procurement shortcuts" description="Operational purchasing actions for restocking and vendor coordination." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Link className="rounded-md border border-slate-200 p-3 text-sm font-semibold hover:bg-slate-50" to="/purchase-orders">
              Create purchase order
              <span className="mt-1 block text-xs font-normal text-slate-500">Draft, submit, approve, and receive</span>
            </Link>
            <Link className="rounded-md border border-slate-200 p-3 text-sm font-semibold hover:bg-slate-50" to="/suppliers">
              Manage suppliers
              <span className="mt-1 block text-xs font-normal text-slate-500">Profiles, contacts, status, notes</span>
            </Link>
            <Link className="rounded-md border border-slate-200 p-3 text-sm font-semibold hover:bg-slate-50" to="/products">
              Review inventory levels
              <span className="mt-1 block text-xs font-normal text-slate-500">Find low stock and reorder needs</span>
            </Link>
            <Link className="rounded-md border border-slate-200 p-3 text-sm font-semibold hover:bg-slate-50" to="/transactions">
              Track receiving history
              <span className="mt-1 block text-xs font-normal text-slate-500">Verify stock-in transactions</span>
            </Link>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = canViewPlatformAnalytics(user?.role);
  const isWarehouseStaff = canUseWarehouseWorkflow(user?.role);
  const isAuditor = canUseAuditorWorkflow(user?.role);
  const isProcurementManager = user?.role === ROLES.PROCUREMENT_MANAGER;
  const showProcurementWidgets = canManageProcurement(user?.role);
  const retailerQuery = useQuery({
    queryKey: ['dashboard', 'retailer'],
    queryFn: getRetailerDashboard,
    enabled: !isAdmin && !isWarehouseStaff && !isAuditor && !isProcurementManager,
  });
  const warehouseQuery = useQuery({
    queryKey: ['dashboard', 'warehouse-staff'],
    queryFn: getWarehouseStaffDashboard,
    enabled: isWarehouseStaff,
  });
  const adminQuery = useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: getAdminDashboard,
    enabled: isAdmin,
  });
  const auditorQuery = useQuery({
    queryKey: ['dashboard', 'auditor'],
    queryFn: getAuditorDashboard,
    enabled: isAuditor,
  });
  const procurementQuery = useQuery({
    queryKey: ['dashboard', 'procurement'],
    queryFn: getProcurementDashboard,
    enabled: isProcurementManager,
  });
  const productsQuery = useQuery<Product[]>({
    queryKey: ['products', 'dashboard-analytics'],
    queryFn: () => listProducts({ limit: 500, offset: 0 }),
    enabled: !isAdmin && !isWarehouseStaff && !isAuditor && !isProcurementManager,
  });
  const activeQuery = isAdmin
    ? adminQuery
    : isWarehouseStaff
      ? warehouseQuery
      : isAuditor
        ? auditorQuery
        : isProcurementManager
          ? procurementQuery
          : retailerQuery;

  return (
    <Page>
      <PageHeader
        eyebrow={isAdmin ? 'Platform' : isWarehouseStaff ? 'Warehouse operations' : isAuditor ? 'Compliance' : isProcurementManager ? 'Procurement' : 'Operations'}
        title={
          isAdmin
            ? 'Platform control center'
            : isWarehouseStaff
              ? 'Warehouse staff dashboard'
            : isAuditor
              ? 'Auditor review dashboard'
            : isProcurementManager
              ? 'Procurement dashboard'
            : showProcurementWidgets
              ? 'Retailer dashboard'
              : 'Inventory operations dashboard'
        }
        description={
          isAdmin
            ? 'Monitor tenant health with aggregate analytics and privacy-aware summaries.'
            : isWarehouseStaff
              ? 'Fast stock movement, scan, dispatch, and assigned warehouse work queues.'
            : isAuditor
              ? 'Read-only inventory compliance, transaction review, and security monitoring.'
            : isProcurementManager
              ? 'Purchasing, supplier performance, incoming shipments, and reorder recommendations.'
            : showProcurementWidgets
              ? 'Inventory activity, procurement signals, and operational health in one workspace.'
              : 'Inventory activity, stock alerts, product summaries, and operational movement.'
        }
      />

      {activeQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      ) : activeQuery.isError ? (
        <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> Dashboard analytics could not be loaded.
        </p>
      ) : activeQuery.data ? (
        <>
          {isAdmin && adminQuery.data ? (
            <AdminDashboardView dashboard={adminQuery.data} />
          ) : isWarehouseStaff && warehouseQuery.data ? (
            <WarehouseStaffDashboardView dashboard={warehouseQuery.data} />
          ) : isAuditor && auditorQuery.data ? (
            <AuditorDashboardView dashboard={auditorQuery.data} />
          ) : isProcurementManager && procurementQuery.data ? (
            <ProcurementDashboardView dashboard={procurementQuery.data} />
          ) : retailerQuery.data ? (
            <InventoryOperationsDashboardView
              dashboard={retailerQuery.data}
              showProcurementWidgets={showProcurementWidgets}
              products={productsQuery.data ?? []}
              productsLoading={productsQuery.isLoading}
              canImportStarterData={user?.role === ROLES.RETAILER_ADMIN}
            />
          ) : null}
          <ActivityFeedPanel />
        </>
      ) : (
        <p className="text-sm text-slate-500">No dashboard data available.</p>
      )}
    </Page>
  );
}
