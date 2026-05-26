import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertCircle, ArrowLeft, Boxes, PackageCheck, Users } from 'lucide-react';

import { getAdminTenantDrilldown, type ActivityTrend } from '../lib/dashboard-api';

function formatDate(value?: string | null) {
  if (!value) {
    return 'No activity';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: typeof Boxes }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value.toLocaleString()}</p>
    </section>
  );
}

function ActivityTrendBars({ trends }: { trends: ActivityTrend[] }) {
  const max = Math.max(1, ...trends.map((trend) => trend.transaction_count));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Activity trend</h2>
      <p className="mt-1 text-sm text-slate-500">Daily aggregate event volume. No transaction-level detail.</p>
      {trends.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No recent tenant activity.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {trends.map((trend) => (
            <div key={trend.period}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">{trend.period}</span>
                <span className="text-slate-500">
                  {trend.transaction_count.toLocaleString()} events · {trend.units_moved.toLocaleString()} units
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-900"
                  style={{ width: `${Math.max(6, (trend.transaction_count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TenantDrilldownPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const query = useQuery({
    queryKey: ['dashboard', 'admin', 'tenant', tenantId],
    queryFn: () => getAdminTenantDrilldown(String(tenantId)),
    enabled: Boolean(tenantId),
  });
  const data = query.data;

  return (
    <main className="p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/app" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
            <ArrowLeft className="h-4 w-4" /> Back to control center
          </Link>
          <h1 className="text-2xl font-semibold">{data?.tenant.company_name ?? 'Tenant overview'}</h1>
          <p className="text-sm text-slate-500">Read-only aggregate tenant analytics for platform monitoring.</p>
        </div>
        {data ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium capitalize text-slate-600">
            {data.tenant.status}
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> Tenant analytics could not be loaded.
        </p>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Active users" value={data.tenant.active_users} icon={Users} />
            <StatCard title="Products" value={data.tenant.product_count} icon={Boxes} />
            <StatCard title="Inventory units" value={data.tenant.inventory_units} icon={PackageCheck} />
            <StatCard title="Low-stock products" value={data.low_stock_products} icon={AlertCircle} />
            <StatCard
              title="Activity events"
              value={
                data.activity_trends.reduce((total, trend) => total + trend.transaction_count, 0)
              }
              icon={Activity}
            />
          </div>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Tenant overview</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="font-medium text-slate-500">Tenant ID</dt>
                <dd className="mt-1 break-all text-slate-900">{data.tenant.tenant_id}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Last activity</dt>
                <dd className="mt-1 text-slate-900">{formatDate(data.tenant.last_activity_at)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Inbound units</dt>
                <dd className="mt-1 text-slate-900">{data.movement_summary.stock_in.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Outbound units</dt>
                <dd className="mt-1 text-slate-900">{data.movement_summary.stock_out.toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,420px)_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Category distribution</h2>
              <p className="mt-1 text-sm text-slate-500">Aggregate product categories only.</p>
              {data.category_stats.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">No category data.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.category_stats.map((category) => (
                    <div key={category.category} className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{category.category}</p>
                        <span className="text-sm text-slate-500">{category.product_count} products</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {category.total_quantity.toLocaleString()} units
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <ActivityTrendBars trends={data.activity_trends} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">No tenant analytics available.</p>
      )}
    </main>
  );
}
