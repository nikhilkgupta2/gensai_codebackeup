import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Plus } from 'lucide-react';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import { Page, PageHeader, Toolbar } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import { StatWidget } from '../components/ui/StatWidget';
import { listProducts, type Product } from '../lib/product-api';
import { listWarehouses, type Warehouse } from '../lib/warehouse-api';
import {
  createPurchaseOrder,
  getPurchaseOrderAnalytics,
  listPurchaseOrders,
  listSuppliers,
  type PurchaseOrderItemPayload,
  type PurchaseOrderPayload,
  type PurchaseOrderStatus,
  type Supplier,
} from '../lib/procurement-api';

const statusLabels: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  partially_received: 'Partially Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusTone: Record<PurchaseOrderStatus, 'slate' | 'green' | 'amber' | 'blue' | 'red' | 'violet'> = {
  draft: 'slate',
  pending: 'amber',
  approved: 'blue',
  partially_received: 'violet',
  completed: 'green',
  cancelled: 'red',
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

function CreatePurchaseOrderModal({
  suppliers,
  products,
  warehouses,
  onClose,
  onCreated,
}: {
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PurchaseOrderPayload>({
    supplier_id: suppliers[0]?.id ?? '',
    warehouse_id: warehouses[0]?.id ?? '',
    expected_delivery_date: '',
    notes: '',
    items: [{ product_id: products[0]?.id ?? '', quantity_ordered: 1, unit_price: 0 }],
  });
  const mutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order-analytics'] });
      onCreated();
    },
  });

  const updateItem = (index: number, next: Partial<PurchaseOrderItemPayload>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
    }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({
      ...form,
      warehouse_id: form.warehouse_id || undefined,
      expected_delivery_date: form.expected_delivery_date || undefined,
      notes: form.notes?.trim() || undefined,
      items: form.items.filter((item) => item.product_id),
    });
  };

  return (
    <Modal
      title="New purchase order"
      description="Create a draft order with one or more product lines."
      onClose={onClose}
      className="max-w-4xl"
    >
        <form className="space-y-5 p-5" onSubmit={submit}>
          {mutation.isError ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{getErrorMessage(mutation.error)}</p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Supplier</span>
              <Select
                required
                value={form.supplier_id}
                onChange={(event) => setForm((prev) => ({ ...prev, supplier_id: event.target.value }))}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Warehouse destination</span>
              <Select
                value={form.warehouse_id ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, warehouse_id: event.target.value || undefined }))}
              >
                <option value="">No warehouse selected</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Expected delivery</span>
              <Input
                type="date"
                value={form.expected_delivery_date}
                onChange={(event) => setForm((prev) => ({ ...prev, expected_delivery_date: event.target.value }))}
              />
            </label>
          </div>
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Line items</h3>
              <Button
                type="button"
                className="h-9"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    items: [...prev.items, { product_id: products[0]?.id ?? '', quantity_ordered: 1, unit_price: 0 }],
                  }))
                }
              >
                Add line
              </Button>
            </div>
            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_120px_120px_auto]">
                  <Select
                    value={item.product_id}
                    onChange={(event) => updateItem(index, { product_id: event.target.value })}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.product_name} ({product.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity_ordered}
                    onChange={(event) => updateItem(index, { quantity_ordered: Number(event.target.value) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })}
                  />
                  <Button
                    type="button"
                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))}
                    disabled={form.items.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>
          <div className="flex justify-end gap-3">
            <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || suppliers.length === 0 || products.length === 0}>
              {mutation.isPending ? 'Creating...' : 'Create draft'}
            </Button>
          </div>
        </form>
    </Modal>
  );
}

export function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const query = useQuery({
    queryKey: ['purchase-orders', statusFilter, search],
    queryFn: () =>
      listPurchaseOrders({
        status: (statusFilter as PurchaseOrderStatus) || undefined,
        search: search.trim() || undefined,
        limit: 50,
      }),
  });
  const analyticsQuery = useQuery({
    queryKey: ['purchase-order-analytics'],
    queryFn: getPurchaseOrderAnalytics,
  });
  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'po-picker'],
    queryFn: () => listSuppliers({ status: 'active', limit: 100 }),
  });
  const productsQuery = useQuery<Product[]>({
    queryKey: ['products', 'po-picker'],
    queryFn: () => listProducts({ limit: 500, offset: 0 }),
  });
  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'po-picker'],
    queryFn: () => listWarehouses(),
  });
  const orders = query.data?.purchaseOrders ?? [];
  const suppliers = suppliersQuery.data?.suppliers ?? [];
  const products = productsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const totalOpenValue = useMemo(
    () =>
      orders
        .filter((order) => !['completed', 'cancelled'].includes(order.status))
        .reduce((total, order) => total + order.total_amount, 0),
    [orders],
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Procurement workflow"
        title="Purchase orders"
        description="Order inventory from suppliers and receive stock through approval-controlled workflows."
        actions={
          <Button type="button" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New purchase order
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatWidget title="Total orders" value={analytics?.total_purchase_orders ?? 0} />
        <StatWidget title="Pending orders" value={analytics?.pending_purchase_orders ?? 0} tone="warning" />
        <StatWidget title="Completed orders" value={analytics?.completed_purchase_orders ?? 0} tone="success" />
        <StatWidget title="Overdue orders" value={analytics?.overdue_orders ?? 0} tone="warning" />
        <StatWidget title="Open order value" value={formatCurrency(totalOpenValue)} />
      </div>

      <Toolbar className="mb-5">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <Input placeholder="Search PO number" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Any status</option>
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Toolbar>

      <section>
        {query.isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <LoadingState label="Loading purchase orders..." />
          </div>
        ) : query.isError ? (
          <p className="flex items-center gap-2 rounded-lg border border-red-100 bg-white p-5 text-sm text-red-600 shadow-sm">
            <AlertCircle className="h-4 w-4" /> Failed to load purchase orders.
          </p>
        ) : orders.length === 0 ? (
          <EmptyState title="No purchase orders found" description="Create a purchase order to start structured replenishment." />
        ) : (
          <DataTable>
              <DataTableHeader>
                <tr>
                  <DataTableHead>PO</DataTableHead>
                  <DataTableHead>Supplier</DataTableHead>
                  <DataTableHead>Warehouse</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Received</DataTableHead>
                  <DataTableHead>Expected</DataTableHead>
                  <DataTableHead className="text-right">Value</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {orders.map((order) => (
                  <DataTableRow key={order.id}>
                    <DataTableCell>
                      <Link to={`/purchase-orders/${order.id}`} className="font-medium text-slate-900 underline-offset-4 hover:underline">
                        {order.po_number}
                      </Link>
                    </DataTableCell>
                    <DataTableCell>{order.supplier_name}</DataTableCell>
                    <DataTableCell>{order.warehouse_name ?? '-'}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={statusTone[order.status]}>{statusLabels[order.status]}</Badge>
                    </DataTableCell>
                    <DataTableCell>
                      {order.total_received} / {order.total_ordered}
                    </DataTableCell>
                    <DataTableCell>{order.expected_delivery_date ?? '-'}</DataTableCell>
                    <DataTableCell className="text-right font-medium text-slate-900">{formatCurrency(order.total_amount)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
          </DataTable>
        )}
      </section>

      {showCreate ? (
        <CreatePurchaseOrderModal
          suppliers={suppliers}
          products={products}
          warehouses={warehouses}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      ) : null}
    </Page>
  );
}
