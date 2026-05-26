import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRightLeft, Building2, PackageCheck, Plus, Warehouse } from 'lucide-react';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardGrid, FilterBar, Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import { StatWidget } from '../components/ui/StatWidget';
import { useAuthStore } from '../lib/auth-store';
import { listProducts } from '../lib/product-api';
import {
  approveStockTransfer,
  assignWarehouseInventory,
  cancelStockTransfer,
  completeStockTransfer,
  createStockTransfer,
  createWarehouse,
  listStockTransfers,
  listWarehouseInventory,
  listWarehouses,
  type StockTransfer,
} from '../lib/warehouse-api';
import { ROLES } from '../permissions/capabilities';

const emptyWarehouseForm = { name: '', code: '', manager: '', address: '' };
const emptyTransferForm = { productId: '', sourceWarehouseId: '', destinationWarehouseId: '', quantity: '', notes: '' };
const emptyAssignForm = { warehouseId: '', productId: '', quantity: '' };

function statusTone(status: StockTransfer['status']) {
  if (status === 'completed') return 'green';
  if (status === 'approved') return 'blue';
  if (status === 'cancelled' || status === 'rejected') return 'red';
  return 'amber';
}

export function WarehousesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const canManage = user?.role === ROLES.RETAILER_ADMIN || user?.role === ROLES.INVENTORY_MANAGER;
  const canApprove = user?.role === ROLES.RETAILER_ADMIN;
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [transferStatus, setTransferStatus] = useState<StockTransfer['status'] | 'all'>('all');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [search, setSearch] = useState('');

  const warehousesQuery = useQuery({ queryKey: ['warehouses'], queryFn: () => listWarehouses() });
  const inventoryQuery = useQuery({
    queryKey: ['warehouse-inventory', selectedWarehouseId, search],
    queryFn: () => listWarehouseInventory({ warehouse_id: selectedWarehouseId || undefined, search: search || undefined }),
  });
  const transfersQuery = useQuery({
    queryKey: ['stock-transfers', transferStatus],
    queryFn: () => listStockTransfers(transferStatus === 'all' ? undefined : { status: transferStatus }),
  });
  const transferInventoryQuery = useQuery({
    queryKey: ['warehouse-inventory', 'transfer-picker'],
    queryFn: () => listWarehouseInventory(),
  });
  const productsQuery = useQuery({ queryKey: ['products', 'warehouse-transfer-picker'], queryFn: () => listProducts({ limit: 500, offset: 0 }) });

  const warehouses = warehousesQuery.data ?? [];
  const inventory = inventoryQuery.data ?? [];
  const transfers = transfersQuery.data ?? [];
  const transferInventory = transferInventoryQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const pendingTransfers = transfers.filter((transfer) => transfer.status === 'pending').length;
  const totalUnits = warehouses.reduce((sum, warehouse) => sum + warehouse.total_units, 0);
  const lowStockItems = warehouses.reduce((sum, warehouse) => sum + warehouse.low_stock_items, 0);
  const warehouseOptions = useMemo(() => warehouses.map((warehouse) => ({ id: warehouse.id, label: `${warehouse.name} (${warehouse.code})` })), [warehouses]);
  const selectedSourceWarehouse = warehouses.find((warehouse) => warehouse.id === transferForm.sourceWarehouseId);
  const sourceStockItems = useMemo(() => {
    const assignedItems = transferInventory.filter((item) => item.warehouse_id === transferForm.sourceWarehouseId && item.quantity > 0);
    const assignedProductIds = new Set(assignedItems.map((item) => item.product_id));
    const productLocationItems = products
      .filter(
        (product) =>
          selectedSourceWarehouse &&
          product.warehouse_location === selectedSourceWarehouse.name &&
          product.quantity > 0 &&
          !assignedProductIds.has(product.id),
      )
      .map((product) => ({
        id: `product-location-${product.id}`,
        warehouse_id: transferForm.sourceWarehouseId,
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        category: product.category,
        quantity: product.quantity,
        stock_status: product.quantity <= 0 ? 'out_of_stock' : product.quantity <= 10 ? 'low_stock' : 'available',
      }));
    return [...assignedItems, ...productLocationItems];
  }, [products, selectedSourceWarehouse, transferForm.sourceWarehouseId, transferInventory]);
  const selectedSourceStock = sourceStockItems.find((item) => item.product_id === transferForm.productId);

  const invalidateWarehouseData = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
    queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
  };

  const createWarehouseMutation = useMutation({
    mutationFn: () => createWarehouse({
      name: warehouseForm.name.trim(),
      code: warehouseForm.code.trim(),
      manager: warehouseForm.manager.trim() || undefined,
      address: warehouseForm.address.trim() || undefined,
    }),
    onSuccess: () => {
      setWarehouseForm(emptyWarehouseForm);
      invalidateWarehouseData();
    },
  });

  const createTransferMutation = useMutation({
    mutationFn: () => createStockTransfer({
      product_id: transferForm.productId,
      source_warehouse_id: transferForm.sourceWarehouseId,
      destination_warehouse_id: transferForm.destinationWarehouseId,
      quantity: Number(transferForm.quantity),
      notes: transferForm.notes.trim() || undefined,
    }),
    onSuccess: () => {
      setTransferForm(emptyTransferForm);
      invalidateWarehouseData();
    },
  });

  const assignInventoryMutation = useMutation({
    mutationFn: () => assignWarehouseInventory(assignForm.warehouseId, {
      product_id: assignForm.productId,
      quantity: Number(assignForm.quantity),
    }),
    onSuccess: (item) => {
      setSelectedWarehouseId(item.warehouse_id);
      setAssignForm(emptyAssignForm);
      invalidateWarehouseData();
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: ({ transferId, action }: { transferId: string; action: 'approve' | 'complete' | 'cancel' }) => {
      if (action === 'approve') return approveStockTransfer(transferId);
      if (action === 'complete') return completeStockTransfer(transferId);
      return cancelStockTransfer(transferId);
    },
    onSuccess: invalidateWarehouseData,
  });

  return (
    <Page>
      <PageHeader
        eyebrow="Warehouse operations"
        title="Warehouses"
        description="Manage tenant warehouses, warehouse-level stock, and controlled transfer requests."
      />

      <DashboardGrid className="mb-4 xl:grid-cols-4 2xl:grid-cols-4">
        <StatWidget title="Warehouses" value={warehouses.length.toLocaleString()} icon={Warehouse} />
        <StatWidget title="Warehouse units" value={totalUnits.toLocaleString()} icon={PackageCheck} />
        <StatWidget title="Low-stock locations" value={lowStockItems.toLocaleString()} icon={AlertCircle} />
        <StatWidget title="Pending transfers" value={pendingTransfers.toLocaleString()} icon={ArrowRightLeft} />
      </DashboardGrid>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard>
          <SectionHeader title="Warehouse directory" description="Tenant-scoped warehouse cards and creation workflow." />
          {canManage ? (
            <form
              className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (warehouseForm.name.trim() && warehouseForm.code.trim()) createWarehouseMutation.mutate();
              }}
            >
              <Input className="h-11" placeholder="Warehouse name" value={warehouseForm.name} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, name: event.target.value }))} />
              <Input className="h-11" placeholder="Code" value={warehouseForm.code} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, code: event.target.value }))} />
              <Input className="h-11" placeholder="Manager" value={warehouseForm.manager} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, manager: event.target.value }))} />
              <Input className="h-11" placeholder="Address" value={warehouseForm.address} onChange={(event) => setWarehouseForm((prev) => ({ ...prev, address: event.target.value }))} />
              <Button className="h-11 sm:col-span-2" disabled={createWarehouseMutation.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {createWarehouseMutation.isPending ? 'Creating...' : 'Create warehouse'}
              </Button>
            </form>
          ) : null}
          <div className="divide-y divide-slate-100">
            {warehousesQuery.isLoading ? (
              <div className="p-5"><LoadingState label="Loading warehouses..." /></div>
            ) : warehouses.length === 0 ? (
              <div className="p-5"><EmptyState title="No warehouses yet" description="Create a warehouse or import products with warehouse locations to populate this view." /></div>
            ) : (
              warehouses.map((warehouse) => (
                <button key={warehouse.id} className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50" onClick={() => setSelectedWarehouseId(warehouse.id)} type="button">
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">{warehouse.name}</span>
                    <span className="text-xs text-slate-500">{warehouse.code} · {warehouse.manager || 'No manager assigned'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={warehouse.low_stock_items > 0 ? 'amber' : 'green'}>{warehouse.total_units} units</Badge>
                    <Building2 className="h-4 w-4 text-slate-400" />
                  </span>
                </button>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader title="Warehouse inventory" description="Filter stock by warehouse and product/SKU." />
          <FilterBar className="m-4">
            <Select value={selectedWarehouseId} onChange={(event) => setSelectedWarehouseId(event.target.value)} className="h-11 md:w-64">
              <option value="">All warehouses</option>
              {warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.label}</option>)}
            </Select>
            <Input className="h-11 md:max-w-xs" placeholder="Search product or SKU" value={search} onChange={(event) => setSearch(event.target.value)} />
          </FilterBar>
          {inventoryQuery.isLoading ? (
            <div className="p-5"><LoadingState label="Loading warehouse stock..." /></div>
          ) : inventory.length === 0 ? (
            <div className="p-5"><EmptyState title="No warehouse stock found" description="Warehouse inventory appears after stock is assigned or moved." /></div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 sm:hidden">
                {inventory.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.sku} · {item.category || 'Uncategorized'}</p>
                      </div>
                      <Badge tone={item.stock_status === 'out_of_stock' ? 'red' : item.stock_status === 'low_stock' ? 'amber' : 'green'}>
                        {item.stock_status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{item.quantity.toLocaleString()} units</p>
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact" minWidth="min-w-[760px]">
                  <DataTableHeader><tr><DataTableHead>Product</DataTableHead><DataTableHead>SKU</DataTableHead><DataTableHead>Category</DataTableHead><DataTableHead>Quantity</DataTableHead><DataTableHead>Status</DataTableHead></tr></DataTableHeader>
                  <DataTableBody>
                    {inventory.map((item) => (
                      <DataTableRow key={item.id}>
                        <DataTableCell className="font-semibold text-slate-900">{item.product_name}</DataTableCell>
                        <DataTableCell>{item.sku}</DataTableCell>
                        <DataTableCell>{item.category || '-'}</DataTableCell>
                        <DataTableCell>{item.quantity.toLocaleString()}</DataTableCell>
                        <DataTableCell><Badge tone={item.stock_status === 'out_of_stock' ? 'red' : item.stock_status === 'low_stock' ? 'amber' : 'green'}>{item.stock_status.replace(/_/g, ' ')}</Badge></DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        {canManage ? (
          <SectionCard>
            <SectionHeader title="Warehouse actions" description="Assign product stock and request controlled transfers." />
            <form
              className="space-y-3 border-b border-slate-200 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (assignForm.warehouseId && assignForm.productId && Number(assignForm.quantity) >= 0) assignInventoryMutation.mutate();
              }}
            >
              <p className="text-sm font-semibold text-slate-900">Assign product stock</p>
              <Select className="h-11" value={assignForm.warehouseId} onChange={(event) => setAssignForm((prev) => ({ ...prev, warehouseId: event.target.value }))}>
                <option value="">Warehouse</option>
                {warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.label}</option>)}
              </Select>
              <Select className="h-11" value={assignForm.productId} onChange={(event) => setAssignForm((prev) => ({ ...prev, productId: event.target.value }))}>
                <option value="">Product</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.product_name} ({product.sku})</option>)}
              </Select>
              <Input className="h-11" min="0" type="number" placeholder="Quantity in warehouse" value={assignForm.quantity} onChange={(event) => setAssignForm((prev) => ({ ...prev, quantity: event.target.value }))} />
              {assignInventoryMutation.isError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {assignInventoryMutation.error instanceof Error ? assignInventoryMutation.error.message : 'Assign stock failed.'}
                </p>
              ) : null}
              <Button
                disabled={
                  assignInventoryMutation.isPending ||
                  !assignForm.warehouseId ||
                  !assignForm.productId ||
                  assignForm.quantity === '' ||
                  Number(assignForm.quantity) < 0
                }
                className="h-11 w-full"
              >
                {assignInventoryMutation.isPending ? 'Assigning...' : 'Assign stock'}
              </Button>
            </form>
            <form
              className="space-y-3 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (transferForm.productId && transferForm.sourceWarehouseId && transferForm.destinationWarehouseId && Number(transferForm.quantity) > 0) createTransferMutation.mutate();
              }}
            >
              <Select
                className="h-11"
                value={transferForm.sourceWarehouseId}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, sourceWarehouseId: event.target.value, productId: '', quantity: '' }))}
              >
                <option value="">Source warehouse</option>
                {warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.label}</option>)}
              </Select>
              <Select
                className="h-11"
                value={transferForm.productId}
                disabled={!transferForm.sourceWarehouseId || transferInventoryQuery.isLoading}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, productId: event.target.value, quantity: '' }))}
              >
                <option value="">{transferForm.sourceWarehouseId ? 'Select product in source warehouse' : 'Choose source warehouse first'}</option>
                {sourceStockItems.map((item) => (
                  <option key={item.id} value={item.product_id}>
                    {item.product_name} ({item.sku}) · {item.quantity} available
                  </option>
                ))}
              </Select>
              <Select className="h-11" value={transferForm.destinationWarehouseId} onChange={(event) => setTransferForm((prev) => ({ ...prev, destinationWarehouseId: event.target.value }))}>
                <option value="">Destination warehouse</option>
                {warehouseOptions.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.label}</option>)}
              </Select>
              <Input
                className="h-11"
                min="1"
                max={selectedSourceStock?.quantity}
                type="number"
                placeholder={selectedSourceStock ? `Quantity, max ${selectedSourceStock.quantity}` : 'Quantity'}
                value={transferForm.quantity}
                onChange={(event) => setTransferForm((prev) => ({ ...prev, quantity: event.target.value }))}
              />
              {transferForm.sourceWarehouseId && sourceStockItems.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  No assigned stock is available in this source warehouse. Assign stock first, then request a transfer.
                </p>
              ) : null}
              <Input className="h-11" placeholder="Notes" value={transferForm.notes} onChange={(event) => setTransferForm((prev) => ({ ...prev, notes: event.target.value }))} />
              {createTransferMutation.isError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {createTransferMutation.error instanceof Error ? createTransferMutation.error.message : 'Transfer request failed.'}
                </p>
              ) : null}
              <Button
                type="submit"
                disabled={
                  createTransferMutation.isPending ||
                  !transferForm.productId ||
                  !transferForm.sourceWarehouseId ||
                  !transferForm.destinationWarehouseId ||
                  transferForm.sourceWarehouseId === transferForm.destinationWarehouseId ||
                  Number(transferForm.quantity) <= 0 ||
                  (selectedSourceStock ? Number(transferForm.quantity) > selectedSourceStock.quantity : true)
                }
                className="h-11 w-full"
              >
                {createTransferMutation.isPending ? 'Requesting...' : 'Request transfer'}
              </Button>
            </form>
          </SectionCard>
        ) : null}
        <SectionCard className="min-w-0">
          <SectionHeader title="Transfer requests" description="Approval queue and transfer completion history." />
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
            {(['all', 'pending', 'approved', 'rejected', 'completed'] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  transferStatus === status
                    ? 'border-slate-900 bg-slate-950 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
                onClick={() => setTransferStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
          {transfersQuery.isLoading ? (
            <div className="p-5"><LoadingState label="Loading transfers..." /></div>
          ) : transfers.length === 0 ? (
            <div className="p-5"><EmptyState title="No transfer requests" description="Warehouse transfers will appear here when teams request stock movement." /></div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 sm:hidden">
                {transfers.map((transfer) => (
                  <div key={transfer.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{transfer.product_name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transfer.source_warehouse_name} → {transfer.destination_warehouse_name}
                        </p>
                      </div>
                      <Badge tone={statusTone(transfer.status)}>{transfer.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-slate-900">
                        {transfer.quantity.toLocaleString()} units
                        {transfer.items?.[0]?.approved_quantity ? (
                          <span className="ml-1 text-xs font-medium text-slate-500">({transfer.items[0].approved_quantity} moved)</span>
                        ) : null}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {canApprove && transfer.status === 'pending' ? <button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'approve' })}>Approve</button> : null}
                        {canManage && transfer.status === 'approved' ? <button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'complete' })}>Complete</button> : null}
                        {canManage && !['completed', 'cancelled', 'rejected'].includes(transfer.status) ? <button className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'cancel' })}>Cancel</button> : null}
                      </div>
                    </div>
                    {transfer.admin_notes ? <p className="mt-2 text-xs text-slate-500">Admin: {transfer.admin_notes}</p> : null}
                  </div>
                ))}
              </div>
              <div className="hidden sm:block">
                <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact" minWidth="min-w-[860px]">
                  <DataTableHeader><tr><DataTableHead>Product</DataTableHead><DataTableHead>Route</DataTableHead><DataTableHead>Qty</DataTableHead><DataTableHead>Status</DataTableHead><DataTableHead>Actions</DataTableHead></tr></DataTableHeader>
                  <DataTableBody>
                    {transfers.map((transfer) => (
                      <DataTableRow key={transfer.id}>
                        <DataTableCell className="font-semibold text-slate-900">{transfer.product_name}</DataTableCell>
                        <DataTableCell>{transfer.source_warehouse_name} → {transfer.destination_warehouse_name}</DataTableCell>
                        <DataTableCell>
                          <span>{transfer.quantity.toLocaleString()}</span>
                          {transfer.items?.[0]?.approved_quantity ? (
                            <span className="ml-1 text-xs text-slate-500">({transfer.items[0].approved_quantity} moved)</span>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell><Badge tone={statusTone(transfer.status)}>{transfer.status}</Badge></DataTableCell>
                        <DataTableCell>
                          <div className="flex gap-2">
                            {canApprove && transfer.status === 'pending' ? <button className="text-xs font-semibold underline" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'approve' })}>Approve</button> : null}
                            {canManage && transfer.status === 'approved' ? <button className="text-xs font-semibold underline" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'complete' })}>Complete</button> : null}
                            {canManage && !['completed', 'cancelled', 'rejected'].includes(transfer.status) ? <button className="text-xs font-semibold text-red-700 underline" type="button" onClick={() => transitionMutation.mutate({ transferId: transfer.id, action: 'cancel' })}>Cancel</button> : null}
                          </div>
                          {transfer.admin_notes ? <p className="mt-1 text-xs text-slate-500">Admin: {transfer.admin_notes}</p> : null}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </Page>
  );
}
