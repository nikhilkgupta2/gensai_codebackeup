import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, PackageCheck, X } from 'lucide-react';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuthStore } from '../lib/auth-store';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from '../lib/procurement-api';

const statusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  partially_received: 'Partially Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) {
      return detail;
    }
  }
  return 'Something went wrong.';
}

function ReceiveModal({
  order,
  onClose,
}: {
  order: PurchaseOrder;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(order.items.map((item) => [item.id, '0'])),
  );
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      receivePurchaseOrder(order.id, {
        items: order.items
          .map((item) => ({ item_id: item.id, quantity: Number(quantities[item.id] || 0) }))
          .filter((item) => item.quantity > 0),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Receive inventory</h2>
            <p className="text-sm text-slate-500">Partial receiving is supported.</p>
          </div>
          <button type="button" className="rounded-md border border-slate-200 p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {mutation.isError ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{getErrorMessage(mutation.error)}</p>
          ) : null}
          {order.items.map((item) => (
            <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_160px] md:items-center">
              <div>
                <p className="font-medium text-slate-900">{item.product_name}</p>
                <p className="text-sm text-slate-500">
                  {item.sku} · remaining {item.quantity_remaining}
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={item.quantity_remaining}
                value={quantities[item.id] ?? '0'}
                disabled={item.quantity_remaining <= 0}
                onChange={(event) => setQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))}
              />
            </div>
          ))}
          <textarea
            placeholder="Receiving notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Receiving...' : 'Receive stock'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function PurchaseOrderDetailPage() {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [showReceive, setShowReceive] = useState(false);
  const query = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => getPurchaseOrder(String(purchaseOrderId)),
    enabled: Boolean(purchaseOrderId),
  });
  const order = query.data;
  const canApprove = user?.role === 'retailer_admin' || user?.role === 'procurement_manager';
  const canReceive =
    user?.role === 'retailer_admin' ||
    user?.role === 'inventory_manager' ||
    user?.role === 'procurement_manager';
  const canReceiveStatus = order?.status === 'approved' || order?.status === 'partially_received';

  const transitionMutation = useMutation({
    mutationFn: (action: 'submit' | 'approve' | 'cancel') => {
      if (!purchaseOrderId) {
        throw new Error('Missing purchase order id.');
      }
      if (action === 'submit') {
        return submitPurchaseOrder(purchaseOrderId);
      }
      if (action === 'approve') {
        return approvePurchaseOrder(purchaseOrderId);
      }
      return cancelPurchaseOrder(purchaseOrderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-analytics'] });
    },
  });

  return (
    <main className="p-5">
      <div className="mb-5">
        <Link to="/purchase-orders" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" /> Back to purchase orders
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{order?.po_number ?? 'Purchase order'}</h1>
            <p className="text-sm text-slate-500">{order?.supplier_name ?? 'Supplier order details'}</p>
          </div>
          {order ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
                {statusLabels[order.status]}
              </span>
              {canApprove && order.status === 'draft' ? (
                <Button type="button" onClick={() => transitionMutation.mutate('submit')}>
                  Submit
                </Button>
              ) : null}
              {canApprove && ['draft', 'pending'].includes(order.status) ? (
                <Button type="button" onClick={() => transitionMutation.mutate('approve')}>
                  Approve
                </Button>
              ) : null}
              {canApprove && !['completed', 'cancelled'].includes(order.status) ? (
                <Button type="button" className="bg-red-600 hover:bg-red-500" onClick={() => transitionMutation.mutate('cancel')}>
                  Cancel
                </Button>
              ) : null}
              {canReceive && canReceiveStatus ? (
                <Button type="button" onClick={() => setShowReceive(true)}>
                  <PackageCheck className="mr-2 h-4 w-4" /> Receive
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-slate-500">Loading purchase order...</p>
      ) : query.isError ? (
        <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> Purchase order could not be loaded.
        </p>
      ) : order ? (
        <>
          {transitionMutation.isError ? (
            <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{getErrorMessage(transitionMutation.error)}</p>
          ) : null}
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total ordered</p>
              <p className="mt-2 text-2xl font-semibold">{order.total_ordered}</p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total received</p>
              <p className="mt-2 text-2xl font-semibold">{order.total_received}</p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Order value</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(order.total_amount)}</p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Warehouse destination</p>
              <p className="mt-2 text-lg font-semibold">{order.warehouse_name ?? 'Not assigned'}</p>
            </section>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Line items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 font-medium text-slate-700">Product</th>
                    <th className="px-3 py-3 font-medium text-slate-700">Ordered</th>
                    <th className="px-3 py-3 font-medium text-slate-700">Received</th>
                    <th className="px-3 py-3 font-medium text-slate-700">Remaining</th>
                    <th className="px-3 py-3 font-medium text-slate-700">Unit price</th>
                    <th className="px-3 py-3 font-medium text-slate-700">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{item.product_name}</div>
                        <div className="text-xs text-slate-500">{item.sku}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{item.quantity_ordered}</td>
                      <td className="px-3 py-3 text-slate-600">{item.quantity_received}</td>
                      <td className="px-3 py-3 text-slate-600">{item.quantity_remaining}</td>
                      <td className="px-3 py-3 text-slate-600">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">{formatCurrency(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Audit trail</h2>
            {order.audit_logs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No audit records yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {order.audit_logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium capitalize text-slate-900">{log.action.replace('_', ' ')}</p>
                      <p className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{log.details}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {showReceive ? <ReceiveModal order={order} onClose={() => setShowReceive(false)} /> : null}
        </>
      ) : null}
    </main>
  );
}
