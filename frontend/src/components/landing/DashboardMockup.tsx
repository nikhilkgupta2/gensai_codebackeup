import { Activity, AlertTriangle, Boxes, Building2, ShieldCheck } from 'lucide-react';

import { cn } from '../../lib/cn';

const rows = [
  ['Acme Retail', 'Active', '1,127 units', 'Healthy'],
  ['Northline Warehouse', 'Review', '428 units', 'Low stock'],
  ['Urban Market', 'Active', '2,016 units', 'Healthy'],
];

export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-5xl rounded-lg border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/70',
        className,
      )}
    >
      <div className="rounded-md border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-300" />
            <span className="h-3 w-3 rounded-full bg-amber-300" />
            <span className="h-3 w-3 rounded-full bg-emerald-300" />
          </div>
          <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 sm:block">
            live tenant workspace
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-slate-200 bg-white p-4 lg:block">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-sm font-bold text-white">I</div>
              <div>
                <p className="text-sm font-semibold text-slate-950">IMS Cloud</p>
                <p className="text-xs text-slate-500">Retail operations</p>
              </div>
            </div>
            {['Dashboard', 'Products', 'Inventory', 'Purchase Orders', 'Suppliers'].map((item, index) => (
              <div
                key={item}
                className={`mb-2 rounded-md px-3 py-2 text-sm ${index === 0 ? 'bg-slate-950 text-white' : 'text-slate-600'}`}
              >
                {item}
              </div>
            ))}
          </aside>

          <div className="p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Platform overview</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">Tenant inventory health</h3>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> RBAC enforced
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Tenants', '42', Building2],
                ['Products', '18.4k', Boxes],
                ['Alerts', '16', AlertTriangle],
              ].map(([label, value, Icon]) => (
                <div key={label as string} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{label as string}</p>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{value as string}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_280px]">
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-slate-950">Tenant summary</p>
                  <p className="text-xs text-slate-500">Updated now</p>
                </div>
                <div className="space-y-3">
                  {rows.map(([tenant, status, units, risk]) => (
                    <div key={tenant} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-slate-50 px-3 py-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-900">{tenant}</span>
                      <span className="sr-only">
                        {status}, {units}
                      </span>
                      <span className={risk === 'Low stock' ? 'text-amber-700' : 'text-emerald-700'}>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold text-slate-950">Movement</p>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <div className="space-y-4">
                  {[
                    ['Stock in', 86],
                    ['Stock out', 52],
                    ['Adjustments', 18],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>{label as string}</span>
                        <span>{value as number}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-950" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
