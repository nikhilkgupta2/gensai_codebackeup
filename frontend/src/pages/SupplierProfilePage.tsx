import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, PackageCheck, ShieldCheck, Truck } from 'lucide-react';

import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { StatWidget } from '../components/ui/StatWidget';
import { getSupplierProfile } from '../lib/procurement-api';

const statusTone = {
  draft: 'slate',
  pending: 'amber',
  approved: 'blue',
  partially_received: 'violet',
  completed: 'green',
  cancelled: 'red',
} as const;

export function SupplierProfilePage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const query = useQuery({
    queryKey: ['supplier-profile', supplierId],
    queryFn: () => getSupplierProfile(String(supplierId)),
    enabled: Boolean(supplierId),
  });
  const profile = query.data;

  return (
    <Page>
      <Link to="/suppliers" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" />
        Back to suppliers
      </Link>
      <PageHeader
        eyebrow="Supplier profile"
        title={profile?.supplier.name ?? 'Supplier'}
        description="Review procurement contact details, delivery history, and supplier reliability."
      />

      {query.isLoading ? (
        <SectionCard className="p-5"><LoadingState label="Loading supplier profile..." /></SectionCard>
      ) : query.isError ? (
        <p className="flex items-center gap-2 rounded-lg border border-red-100 bg-white p-5 text-sm text-red-600 shadow-sm">
          <AlertCircle className="h-4 w-4" /> Supplier profile could not be loaded.
        </p>
      ) : profile ? (
        <>
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <StatWidget title="Reliability score" value={`${profile.reliability_score}%`} icon={ShieldCheck} />
            <StatWidget title="Purchase orders" value={profile.total_purchase_orders.toLocaleString()} icon={Truck} />
            <StatWidget title="Completed orders" value={profile.completed_purchase_orders.toLocaleString()} icon={PackageCheck} />
            <StatWidget title="Delayed deliveries" value={profile.delayed_deliveries.toLocaleString()} icon={AlertCircle} tone="warning" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <SectionCard>
              <SectionHeader title="Contact information" description="Supplier profile and coordination details." />
              <div className="space-y-3 p-5 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{profile.supplier.contact_name ?? 'No contact name'}</p>
                  <p className="text-slate-500">{profile.supplier.contact_email ?? 'No email'}</p>
                  <p className="text-slate-500">{profile.supplier.contact_phone ?? 'No phone'}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">Address</p>
                  <p className="mt-1 text-slate-500">{profile.supplier.address ?? 'No address on file.'}</p>
                </div>
                <Badge tone={profile.supplier.status === 'active' ? 'green' : 'slate'}>{profile.supplier.status}</Badge>
              </div>
            </SectionCard>

            <SectionCard className="min-w-0">
              <SectionHeader title="Delivery history" description="Recent supplier purchase orders and receiving progress." />
              {profile.delivery_history.length === 0 ? (
                <div className="p-5"><EmptyState title="No delivery history" description="Supplier delivery history appears after purchase orders are created." /></div>
              ) : (
                <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact">
                  <DataTableHeader>
                    <tr>
                      <DataTableHead>PO</DataTableHead>
                      <DataTableHead>Status</DataTableHead>
                      <DataTableHead>Received</DataTableHead>
                      <DataTableHead>Expected</DataTableHead>
                      <DataTableHead className="text-right">Value</DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {profile.delivery_history.map((order) => (
                      <DataTableRow key={order.purchase_order_id}>
                        <DataTableCell>
                          <Link to={`/purchase-orders/${order.purchase_order_id}`} className="font-semibold text-slate-900 underline-offset-4 hover:underline">
                            {order.po_number}
                          </Link>
                        </DataTableCell>
                        <DataTableCell><Badge tone={statusTone[order.status]}>{order.status.replace('_', ' ')}</Badge></DataTableCell>
                        <DataTableCell>{order.total_received} / {order.total_ordered}</DataTableCell>
                        <DataTableCell>{order.expected_delivery_date ?? '-'}</DataTableCell>
                        <DataTableCell className="text-right font-semibold text-slate-900">${order.total_amount.toFixed(2)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </Page>
  );
}
