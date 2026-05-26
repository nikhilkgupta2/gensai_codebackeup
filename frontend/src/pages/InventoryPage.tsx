import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  PackageCheck,
  RefreshCw,
  ScanLine,
  Warehouse,
} from 'lucide-react';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardGrid, Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import { StatWidget } from '../components/ui/StatWidget';
import { requestStockAdjustment } from '../lib/audit-api';
import {
  adjustInventory,
  listInventoryHistory,
  scanProduct,
  stockIn,
  stockOut,
  type InventoryMovementPayload,
  type InventoryTransactionType,
} from '../lib/inventory-api';
import { listProducts, type Product } from '../lib/product-api';
import { useAuthStore } from '../lib/auth-store';

type MovementFormState = {
  transactionType: InventoryTransactionType;
  productId: string;
  quantity: string;
  notes: string;
};

const initialForm: MovementFormState = {
  transactionType: 'STOCK_IN',
  productId: '',
  quantity: '',
  notes: '',
};

const transactionLabels: Record<InventoryTransactionType, string> = {
  STOCK_IN: 'Stock in',
  STOCK_OUT: 'Stock out',
  ADJUSTMENT: 'Adjustment',
};

const transactionTone: Record<InventoryTransactionType, 'green' | 'red' | 'blue'> = {
  STOCK_IN: 'green',
  STOCK_OUT: 'red',
  ADJUSTMENT: 'blue',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function productLabel(product?: Product) {
  if (!product) {
    return 'Unknown product';
  }
  return `${product.product_name} (${product.sku})`;
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<MovementFormState>(initialForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
  } = useQuery<Product[]>({
    queryKey: ['products', 'inventory-picker'],
    queryFn: () => listProducts({ limit: 500, offset: 0 }),
  });

  const historyQuery = useQuery({
    queryKey: ['inventory-history', 'recent'],
    queryFn: () =>
      listInventoryHistory({
        limit: 8,
        offset: 0,
      }),
  });
  const history = historyQuery.data ?? [];

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const selectedProduct = productsById.get(form.productId);
  const assignedWarehouse = currentUser?.role === 'warehouse_staff' ? currentUser.assigned_warehouse : null;
  const canUseScanner = currentUser?.role === 'warehouse_staff' || currentUser?.role === 'inventory_manager' || currentUser?.role === 'retailer_admin';
  const lowStockCount = products.filter((product) => product.quantity > 0 && product.quantity <= 10).length;
  const outOfStockCount = products.filter((product) => product.quantity <= 0).length;
  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);

  const mutation = useMutation<unknown, Error, InventoryMovementPayload>({
    mutationFn: (payload: InventoryMovementPayload) => {
      if (form.transactionType === 'ADJUSTMENT' && currentUser?.role === 'inventory_manager') {
        return requestStockAdjustment({
          product_id: payload.product_id,
          quantity: payload.quantity,
          notes: payload.notes,
        });
      }
      if (form.transactionType === 'STOCK_IN') {
        return stockIn(payload);
      }
      if (form.transactionType === 'STOCK_OUT') {
        return stockOut(payload);
      }
      return adjustInventory(payload);
    },
    onSuccess: () => {
      setForm(initialForm);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: (code: string) => scanProduct(code, 'keyboard'),
    onSuccess: (scan) => {
      setForm((prev) => ({ ...prev, productId: scan.product_id }));
      setScanMessage(`Loaded ${scan.product_name} (${scan.sku}).`);
      setScanValue('');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => {
      setScanMessage('No assigned product matched that barcode or SKU.');
    },
  });

  useEffect(() => {
    if (canUseScanner) {
      scanInputRef.current?.focus();
    }
  }, [canUseScanner]);

  useEffect(() => {
    const scannedCode = searchParams.get('scan');
    if (!scannedCode || scanMutation.status === 'pending') {
      return;
    }
    setScanValue(scannedCode);
    scanMutation.mutate(scannedCode);
    const next = new URLSearchParams(searchParams);
    next.delete('scan');
    setSearchParams(next, { replace: true });
  }, [scanMutation, searchParams, setSearchParams]);

  const handleScanSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = scanValue.trim();
    if (!code) {
      return;
    }
    scanMutation.mutate(code);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(form.quantity);
    if (!form.productId) {
      setFormError('Choose a product before saving a stock movement.');
      return;
    }
    if (!Number.isFinite(quantity)) {
      setFormError('Enter a valid quantity.');
      return;
    }
    if (form.transactionType === 'ADJUSTMENT' ? quantity === 0 : quantity <= 0) {
      setFormError(
        form.transactionType === 'ADJUSTMENT'
          ? 'Adjustment quantity cannot be zero.'
          : 'Quantity must be greater than zero.',
      );
      return;
    }
    mutation.mutate({
      product_id: form.productId,
      quantity,
      notes: form.notes.trim() || undefined,
    });
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Warehouse operations"
        title="Stock management"
        description="Run controlled stock in, stock out, and adjustment workflows without mixing operational actions with full audit history."
      />

      <DashboardGrid className="mb-4 xl:grid-cols-4 2xl:grid-cols-4">
        <StatWidget title="Tracked products" value={products.length.toLocaleString()} icon={PackageCheck} />
        <StatWidget title="Inventory units" value={totalUnits.toLocaleString()} icon={Warehouse} />
        <StatWidget title="Low stock alerts" value={lowStockCount.toLocaleString()} icon={AlertCircle} />
        <StatWidget title="Recent movements" value={history.length.toLocaleString()} icon={Activity} />
      </DashboardGrid>

      {canUseScanner ? (
        <SectionCard className="mb-4">
          <SectionHeader
            title="Scanner workflow"
            description="Scan or type a barcode/SKU, press Enter, then post the stock movement with minimal touch input."
            actions={
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {assignedWarehouse ? `Warehouse: ${assignedWarehouse}` : 'Tenant inventory scan'}
              </span>
            }
          />
          <form className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:p-5" onSubmit={handleScanSubmit}>
            <label className="space-y-2 text-sm font-medium">
              <span>Barcode / SKU lookup</span>
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  ref={scanInputRef}
                  className="h-12 pl-10 text-base"
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  placeholder="Scan barcode or enter SKU"
                />
              </div>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="h-12 w-full sm:w-auto">
                {scanMutation.status === 'pending' ? 'Scanning...' : 'Load item'}
              </Button>
            </div>
            {scanMessage ? <p className="text-sm text-slate-600 sm:col-span-2">{scanMessage}</p> : null}
          </form>
        </SectionCard>
      ) : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(360px,520px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <SectionCard className="min-w-0">
          <SectionHeader title="Create stock movement" description="Primary operational workflow for tenant-owned stock changes." />
          <form className="space-y-4 p-4 sm:p-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>Movement type</span>
                <Select
                  className="h-11"
                  value={form.transactionType}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      transactionType: event.target.value as InventoryTransactionType,
                    }))
                  }
                >
                  <option value="STOCK_IN">Stock in</option>
                  <option value="STOCK_OUT">Stock out</option>
                  <option value="ADJUSTMENT">Adjustment</option>
                </Select>
              </label>

              <label className="block space-y-2 text-sm font-medium">
                <span>Quantity</span>
                <Input
                  className="h-11"
                  type="number"
                  value={form.quantity}
                  onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  placeholder={form.transactionType === 'ADJUSTMENT' ? 'Use negative values' : '0'}
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium">
              <span>Product</span>
              <Select
                className="h-11"
                value={form.productId}
                onChange={(event) => setForm((prev) => ({ ...prev, productId: event.target.value }))}
                disabled={productsLoading}
              >
                <option value="">{productsLoading ? 'Loading products...' : 'Select product'}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name} ({product.sku})
                  </option>
                ))}
              </Select>
              {selectedProduct ? (
                <span className="block text-xs font-normal text-slate-500">
                  Current quantity: {selectedProduct.quantity}
                </span>
              ) : null}
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[110px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </label>

            {(formError || mutation.isError || productsError) && (
              <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {formError ??
                  (productsError
                    ? 'Products could not be loaded.'
                    : 'Inventory movement could not be saved.')}
              </p>
            )}

            <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
              <Button type="submit" disabled={mutation.status === 'pending' || productsLoading} className="h-11 w-full sm:w-auto">
                {mutation.status === 'pending'
                  ? 'Saving movement...'
                  : form.transactionType === 'ADJUSTMENT' && currentUser?.role === 'inventory_manager'
                    ? 'Submit for approval'
                    : 'Post stock movement'}
              </Button>
            </div>
          </form>
        </SectionCard>

        <div className="grid min-w-0 gap-4">
          <SectionCard className="min-w-0">
            <SectionHeader title="Product context" description="Live inventory context for the selected item." />
            <div className="p-4 sm:p-5">
              {selectedProduct ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">SKU</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedProduct.sku}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">On hand</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{selectedProduct.quantity.toLocaleString()} units</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Location</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">{selectedProduct.warehouse_location || 'Not assigned'}</p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Stock status</p>
                    <div className="mt-1">
                      <Badge tone={selectedProduct.quantity <= 0 ? 'red' : selectedProduct.quantity <= 10 ? 'amber' : 'green'}>
                        {selectedProduct.quantity <= 0 ? 'Out of stock' : selectedProduct.quantity <= 10 ? 'Low stock' : 'Available'}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Select a product"
                  description="Product quantity, location, and stock status appear here before you post a movement."
                />
              )}
            </div>
          </SectionCard>

          <SectionCard className="min-w-0">
          <SectionHeader
            title="Recent activity"
            description="Latest stock events only. Use Inventory Transactions for full audit history."
          />

          {historyQuery.isLoading ? (
            <div className="p-5">
              <LoadingState label="Loading inventory history..." />
            </div>
          ) : historyQuery.isError ? (
            <p className="flex items-center gap-2 p-5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" /> Failed to load inventory history.
            </p>
          ) : history.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No recent movements" description="Stock activity will appear here after inventory updates are recorded." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.slice(0, 6).map((transaction) => {
                    const Icon =
                      transaction.transaction_type === 'STOCK_IN'
                        ? ArrowUpCircle
                        : transaction.transaction_type === 'STOCK_OUT'
                          ? ArrowDownCircle
                          : RefreshCw;
                    return (
                      <div key={transaction.id} className="flex min-w-0 items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={transactionTone[transaction.transaction_type]}>
                              {transactionLabels[transaction.transaction_type]}
                            </Badge>
                            <span className="text-sm font-semibold text-slate-900">
                              {transaction.quantity.toLocaleString()} units
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">
                            {productLabel(productsById.get(transaction.product_id))}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(transaction.created_at)}</p>
                        </div>
                      </div>
                    );
              })}
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      {outOfStockCount > 0 ? (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <ClipboardCheck className="h-4 w-4" />
          {outOfStockCount} product{outOfStockCount === 1 ? '' : 's'} currently need replenishment review.
        </p>
      ) : null}
    </Page>
  );
}
