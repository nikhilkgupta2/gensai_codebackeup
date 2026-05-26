import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Download, RefreshCw } from 'lucide-react';

import { Button } from '../components/Button';
import { TransactionsFilters, type TransactionSortOption } from '../components/inventory/TransactionsFilters';
import { Badge } from '../components/ui/Badge';
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import {
  listInventoryHistory,
  type InventoryTransaction,
  type InventoryTransactionType,
} from '../lib/inventory-api';
import { listProducts, type Product } from '../lib/product-api';

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

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function InventoryTransactionsPage() {
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [query, setQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [sortBy, setSortBy] = useState<TransactionSortOption>('newest');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const productsQuery = useQuery<Product[]>({
    queryKey: ['products', 'transaction-filters'],
    queryFn: () => listProducts({ limit: 500, offset: 0 }),
  });

  const historyQuery = useQuery({
    queryKey: ['inventory-history', 'transactions', productId, movementType, warehouse, query],
    queryFn: () =>
      listInventoryHistory({
        product_id: productId || undefined,
        transaction_type: (movementType as InventoryTransactionType) || undefined,
        warehouse_location: warehouse || undefined,
        search: query.trim() || undefined,
        limit: 250,
        offset: 0,
      }),
  });

  const products = productsQuery.data ?? [];
  const transactions = historyQuery.data ?? [];
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouses = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.warehouse_location).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredTransactions = useMemo(() => {
    const search = query.trim().toLowerCase();
    const userSearch = userQuery.trim().toLowerCase();

    return transactions
      .filter((transaction) => {
        const product = productsById.get(transaction.product_id);
        const productText = product ? `${product.product_name} ${product.sku}`.toLowerCase() : '';

        if (movementType && transaction.transaction_type !== movementType) {
          return false;
        }
        if (warehouse && product?.warehouse_location !== warehouse) {
          return false;
        }
        if (userSearch && !(transaction.updated_by ?? 'system').toLowerCase().includes(userSearch)) {
          return false;
        }
        if (search && !productText.includes(search) && !(transaction.notes ?? '').toLowerCase().includes(search)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'quantity_desc') {
          return b.quantity - a.quantity;
        }
        if (sortBy === 'quantity_asc') {
          return a.quantity - b.quantity;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [movementType, productsById, query, sortBy, transactions, userQuery, warehouse]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const visibleTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount = [query, productId, movementType, warehouse, userQuery].filter(Boolean).length;

  const exportCsv = () => {
    downloadReport('csv');
  };

  const buildReportRows = () => [
    ['Date', 'Type', 'Product', 'SKU', 'Warehouse', 'Quantity', 'Updated By', 'Notes'],
    ...filteredTransactions.map((transaction) => {
      const product = productsById.get(transaction.product_id);
      return [
        formatDate(transaction.created_at),
        transactionLabels[transaction.transaction_type],
        product?.product_name ?? 'Unknown product',
        product?.sku ?? '',
        product?.warehouse_location ?? '',
        transaction.quantity,
        transaction.updated_by ?? 'System',
        transaction.notes ?? '',
      ];
    }),
  ];

  const downloadReport = (format: 'csv' | 'excel') => {
    const rows = buildReportRows();
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'excel') {
      const html = `
        <table>
          ${rows
            .map((row, index) => `<tr>${row.map((cell) => `<${index === 0 ? 'th' : 'td'}>${String(cell)}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
            .join('')}
        </table>
      `;
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-audit-report-${date}.xls`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory-audit-report-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = buildReportRows();
    const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
      return;
    }
    reportWindow.document.write(`
      <html>
        <head>
          <title>Inventory Audit Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #0f172a; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            p { color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
            th { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>Inventory Audit Report</h1>
          <p>Generated ${formatDate(new Date().toISOString())}</p>
          <table>
            ${rows
              .map((row, index) => `<tr>${row.map((cell) => `<${index === 0 ? 'th' : 'td'}>${String(cell)}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
              .join('')}
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.print();
  };

  const resetPage = (update: () => void) => {
    update();
    setPage(1);
  };

  const clearFilters = () => {
    setQuery('');
    setProductId('');
    setMovementType('');
    setWarehouse('');
    setUserQuery('');
    setSortBy('newest');
    setPage(1);
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory audit"
        title="Inventory transactions"
        description="Search, filter, export, and review tenant-scoped stock movement history without mixing it into stock operation workflows."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={exportCsv} disabled={filteredTransactions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button type="button" onClick={() => downloadReport('excel')} disabled={filteredTransactions.length === 0} className="bg-slate-700 hover:bg-slate-600">
              Excel
            </Button>
            <Button type="button" onClick={exportPdf} disabled={filteredTransactions.length === 0} className="bg-slate-700 hover:bg-slate-600">
              PDF
            </Button>
          </div>
        }
      />

      <TransactionsFilters
        products={products}
        warehouses={warehouses}
        query={query}
        productId={productId}
        movementType={movementType}
        warehouse={warehouse}
        userQuery={userQuery}
        sortBy={sortBy}
        activeFilterCount={activeFilterCount}
        onQueryChange={(value) => resetPage(() => setQuery(value))}
        onProductChange={(value) => resetPage(() => setProductId(value))}
        onMovementTypeChange={(value) => resetPage(() => setMovementType(value))}
        onWarehouseChange={(value) => resetPage(() => setWarehouse(value))}
        onUserQueryChange={(value) => resetPage(() => setUserQuery(value))}
        onSortChange={setSortBy}
        onClear={clearFilters}
      />

      <SectionCard className="min-w-0 overflow-hidden">
        <SectionHeader
          title="Movement ledger"
          description={`${filteredTransactions.length.toLocaleString()} transaction${filteredTransactions.length === 1 ? '' : 's'} found`}
        />
        {historyQuery.isLoading || productsQuery.isLoading ? (
          <div className="p-5">
            <LoadingState label="Loading inventory transactions..." />
          </div>
        ) : historyQuery.isError || productsQuery.isError ? (
          <p className="flex items-center gap-2 p-5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> Failed to load inventory transactions.
          </p>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No transactions match these filters" description="Clear filters or record stock movements to populate this ledger." />
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {visibleTransactions.map((transaction: InventoryTransaction) => {
                const product = productsById.get(transaction.product_id);
                const Icon =
                  transaction.transaction_type === 'STOCK_IN'
                    ? ArrowUpCircle
                    : transaction.transaction_type === 'STOCK_OUT'
                      ? ArrowDownCircle
                      : RefreshCw;

                return (
                  <div key={transaction.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                          <Badge tone={transactionTone[transaction.transaction_type]}>
                            {transactionLabels[transaction.transaction_type]}
                          </Badge>
                        </div>
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">{productLabel(product)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product?.warehouse_location || 'Unassigned'} · {formatDate(transaction.created_at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-900">
                        {transaction.quantity.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      <p>User: {transaction.updated_by || 'System'}</p>
                      {transaction.notes ? <p className="mt-1 line-clamp-2">{transaction.notes}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block">
              <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact" minWidth="min-w-[980px]">
                <DataTableHeader>
                  <tr>
                    <DataTableHead>Movement</DataTableHead>
                    <DataTableHead>Product</DataTableHead>
                    <DataTableHead>Warehouse</DataTableHead>
                    <DataTableHead className="text-right">Quantity</DataTableHead>
                    <DataTableHead>Audit metadata</DataTableHead>
                    <DataTableHead>Notes</DataTableHead>
                  </tr>
                </DataTableHeader>
                <DataTableBody>
                  {visibleTransactions.map((transaction: InventoryTransaction) => {
                  const product = productsById.get(transaction.product_id);
                  const Icon =
                    transaction.transaction_type === 'STOCK_IN'
                      ? ArrowUpCircle
                      : transaction.transaction_type === 'STOCK_OUT'
                        ? ArrowDownCircle
                        : RefreshCw;

                  return (
                    <DataTableRow key={transaction.id}>
                      <DataTableCell>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <Badge tone={transactionTone[transaction.transaction_type]}>
                            {transactionLabels[transaction.transaction_type]}
                          </Badge>
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="max-w-[260px]">
                          <p className="truncate font-semibold text-slate-900">{productLabel(product)}</p>
                          <p className="truncate text-xs text-slate-500">{product?.category || 'Uncategorized'}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell>{product?.warehouse_location || 'Unassigned'}</DataTableCell>
                      <DataTableCell className="text-right font-semibold text-slate-900">
                        {transaction.quantity.toLocaleString()}
                      </DataTableCell>
                      <DataTableCell>
                        <div className="text-xs">
                          <p className="font-medium text-slate-700">{formatDate(transaction.created_at)}</p>
                          <p className="text-slate-500">User: {transaction.updated_by || 'System'}</p>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="max-w-[320px] truncate">{transaction.notes || '-'}</DataTableCell>
                    </DataTableRow>
                  );
                  })}
                </DataTableBody>
              </DataTable>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Page {page} of {totalPages} · Showing {visibleTransactions.length} of {filteredTransactions.length}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-8 bg-white px-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  disabled={page === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  className="h-8 bg-white px-3 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  disabled={page === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </Page>
  );
}
