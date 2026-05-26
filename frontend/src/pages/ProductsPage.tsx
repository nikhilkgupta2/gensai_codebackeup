import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Barcode, Plus, Printer, Trash2 } from 'lucide-react';

import { Button } from '../components/Button';
import { ProductLabelSheet } from '../components/barcode/ProductLabelSheet';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionHeader, Toolbar } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import { useAuthStore } from '../lib/auth-store';
import { deleteProduct, listProductsPage, type Product, type ProductQuery } from '../lib/product-api';
import { canManageProducts, canUseWarehouseWorkflow } from '../permissions/capabilities';

const DEFAULT_PAGE_SIZE = 10;

function formatCurrency(value?: number | null) {
  return value == null ? '-' : `$${value.toFixed(2)}`;
}

function generateCsv(products: Product[]) {
  const rows = [
    ['Name', 'SKU', 'Category', 'Brand', 'Quantity', 'Price', 'Supplier', 'Location', 'Description'],
    ...products.map((product) => [
      product.product_name,
      product.sku,
      product.category ?? '',
      product.brand ?? '',
      String(product.quantity),
      product.price != null ? product.price.toFixed(2) : '',
      product.supplier ?? '',
      product.warehouse_location ?? '',
      product.description ?? '',
    ]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function generateOperationalCsv(products: Product[]) {
  const rows = [
    ['Name', 'SKU', 'Category', 'Brand', 'Quantity', 'Location', 'Stock Status'],
    ...products.map((product) => [
      product.product_name,
      product.sku,
      product.category ?? '',
      product.brand ?? '',
      String(product.quantity),
      product.warehouse_location ?? '',
      stockLabel(product.quantity),
    ]),
  ];
  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function stockTone(quantity: number) {
  if (quantity <= 0) {
    return 'red' as const;
  }
  if (quantity <= 10) {
    return 'amber' as const;
  }
  return 'green' as const;
}

function stockLabel(quantity: number) {
  if (quantity <= 0) {
    return 'Out of stock';
  }
  if (quantity <= 10) {
    return 'Low stock';
  }
  return 'In stock';
}

export function ProductsPage() {
  const user = useAuthStore((state) => state.user);
  const mayManageProducts = canManageProducts(user?.role);
  const warehouseMode = canUseWarehouseWorkflow(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    product_name: searchParams.get('product_name') ?? '',
    sku: searchParams.get('sku') ?? '',
    category: searchParams.get('category') ?? '',
    brand: searchParams.get('brand') ?? '',
    warehouse_location: searchParams.get('warehouse_location') ?? '',
    supplier: searchParams.get('supplier') ?? '',
    stock_status: searchParams.get('stock_status') ?? '',
    low_stock: searchParams.get('low_stock') === 'true',
    min_price: searchParams.get('min_price') ?? '',
    max_price: searchParams.get('max_price') ?? '',
  });
  const [showLabels, setShowLabels] = useState(false);

  const page = Number(searchParams.get('page') ?? '1');
  const limit = Number(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE));

  const queryParams: ProductQuery = useMemo(() => ({
    product_name: searchParams.get('product_name') ?? undefined,
    sku: searchParams.get('sku') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    brand: searchParams.get('brand') ?? undefined,
    warehouse_location: searchParams.get('warehouse_location') ?? undefined,
    supplier: warehouseMode ? undefined : searchParams.get('supplier') ?? undefined,
    stock_status: (searchParams.get('stock_status') as ProductQuery['stock_status']) ?? undefined,
    low_stock: searchParams.get('low_stock') === 'true',
    min_price: !warehouseMode && searchParams.get('min_price') ? Number(searchParams.get('min_price')) : undefined,
    max_price: !warehouseMode && searchParams.get('max_price') ? Number(searchParams.get('max_price')) : undefined,
    page,
    limit,
  }), [searchParams, page, limit, warehouseMode]);

  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', queryParams],
    queryFn: () => listProductsPage(queryParams),
  });
  const products = data?.products ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams({ page: '1', limit: String(limit) });
    Object.entries({
      product_name: filters.product_name.trim(),
      sku: filters.sku.trim(),
      category: filters.category.trim(),
      brand: filters.brand.trim(),
      warehouse_location: filters.warehouse_location.trim(),
      supplier: warehouseMode ? '' : filters.supplier.trim(),
      stock_status: filters.stock_status,
      min_price: warehouseMode ? '' : filters.min_price,
      max_price: warehouseMode ? '' : filters.max_price,
    }).forEach(([key, value]) => {
      if (value) {
        next.set(key, value);
      }
    });
    if (filters.low_stock) {
      next.set('low_stock', 'true');
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setFilters({
      product_name: '',
      sku: '',
      category: '',
      brand: '',
      warehouse_location: '',
      supplier: '',
      stock_status: '',
      low_stock: false,
      min_price: '',
      max_price: '',
    });
    setSearchParams({ page: '1', limit: String(DEFAULT_PAGE_SIZE) });
  };

  const exportCsv = () => {
    if (!products) {
      return;
    }
    const csv = warehouseMode ? generateOperationalCsv(products) : generateCsv(products);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const nextPage = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('page', String(page + 1));
    return next;
  });

  const prevPage = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('page', String(Math.max(page - 1, 1)));
    return next;
  });

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory catalog"
        title="Products"
        description={
          mayManageProducts
            ? 'Manage inventory items, SKU, price, and stock levels.'
            : warehouseMode
              ? 'Review assigned warehouse stock by product, SKU, location, and status.'
            : 'Review inventory items, SKU details, and current stock levels.'
        }
        actions={
          <>
            {mayManageProducts ? (
              <Link to="/products/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New product
                </Button>
              </Link>
            ) : null}
            <Button type="button" onClick={exportCsv} className="bg-slate-700 hover:bg-slate-600">
              Export CSV
            </Button>
            <Button
              type="button"
              className="bg-slate-700 hover:bg-slate-600"
              onClick={() => setShowLabels((value) => !value)}
            >
              <Barcode className="mr-2 h-4 w-4" /> Labels
            </Button>
          </>
        }
      />

      <Toolbar className="mb-5">
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" onSubmit={handleSearch}>
          <label className="space-y-2 text-sm font-medium">
            <span>Name</span>
            <Input value={filters.product_name} onChange={(event) => setFilters((prev) => ({ ...prev, product_name: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>SKU / barcode</span>
            <Input value={filters.sku} onChange={(event) => setFilters((prev) => ({ ...prev, sku: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Category</span>
            <Input value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Brand</span>
            <Input value={filters.brand} onChange={(event) => setFilters((prev) => ({ ...prev, brand: event.target.value }))} />
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Warehouse</span>
            <Input
              value={filters.warehouse_location}
              onChange={(event) => setFilters((prev) => ({ ...prev, warehouse_location: event.target.value }))}
              placeholder="Location"
            />
          </label>
          {!warehouseMode ? (
            <>
              <label className="space-y-2 text-sm font-medium">
                <span>Supplier</span>
                <Input value={filters.supplier} onChange={(event) => setFilters((prev) => ({ ...prev, supplier: event.target.value }))} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Min price</span>
                <Input type="number" value={filters.min_price} onChange={(event) => setFilters((prev) => ({ ...prev, min_price: event.target.value }))} />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Max price</span>
                <Input type="number" value={filters.max_price} onChange={(event) => setFilters((prev) => ({ ...prev, max_price: event.target.value }))} />
              </label>
            </>
          ) : null}
          <label className="space-y-2 text-sm font-medium">
            <span>Availability</span>
            <Select
              value={filters.stock_status}
              onChange={(event) => setFilters((prev) => ({ ...prev, stock_status: event.target.value }))}
            >
              <option value="">Any stock</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </Select>
          </label>
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={filters.low_stock}
              onChange={(event) => setFilters((prev) => ({ ...prev, low_stock: event.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-slate-950"
            />
            Low stock only
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">Apply</Button>
            <Button type="button" className="bg-slate-700 hover:bg-slate-600" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </Toolbar>

      {showLabels ? (
        <section className="mb-5 rounded-lg border border-slate-200 bg-white shadow-sm">
          <SectionHeader
            title="Printable barcode labels"
            description="Print scannable SKU labels for the current product result set."
            actions={
              <Button type="button" onClick={() => window.print()} disabled={products.length === 0}>
                <Printer className="mr-2 h-4 w-4" /> Print labels
              </Button>
            }
          />
          <div className="p-4 sm:p-5">
            {products.length === 0 ? (
              <EmptyState title="No labels to print" description="Apply filters that return products, then print barcode labels." />
            ) : (
              <ProductLabelSheet products={products} />
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Product list"
          description={`${total.toLocaleString()} items match the current filters.`}
          actions={
            <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          }
        />

        {isLoading ? (
          <div className="p-5">
            <LoadingState label="Loading products..." />
          </div>
        ) : isError ? (
          <p className="flex items-center gap-2 p-5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> Failed to load products.
          </p>
        ) : products.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No products found" description="Adjust filters or add a product to start tracking inventory." />
          </div>
        ) : (
          <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTableHeader>
                <tr>
                  <DataTableHead>Name</DataTableHead>
                  <DataTableHead>SKU</DataTableHead>
                  <DataTableHead>Category</DataTableHead>
                  <DataTableHead className="text-right">Qty</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Location</DataTableHead>
                  {!warehouseMode ? (
                    <>
                      <DataTableHead className="text-right">Price</DataTableHead>
                      <DataTableHead>Supplier</DataTableHead>
                    </>
                  ) : null}
                  {mayManageProducts ? (
                    <DataTableHead>Actions</DataTableHead>
                  ) : null}
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {products.map((product) => (
                  <DataTableRow key={product.id} className={product.quantity <= 10 ? 'bg-amber-50/35' : undefined}>
                    <DataTableCell className="font-medium text-slate-900">
                      <Link to={`/products/${product.id}`} className="hover:text-slate-600 hover:underline">
                        {product.product_name}
                      </Link>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-slate-500">{product.sku}</DataTableCell>
                    <DataTableCell>{product.category ?? '-'}</DataTableCell>
                    <DataTableCell className="text-right font-medium text-slate-900">{product.quantity}</DataTableCell>
                    <DataTableCell>
                      <Badge tone={stockTone(product.quantity)}>{stockLabel(product.quantity)}</Badge>
                    </DataTableCell>
                    <DataTableCell>{product.warehouse_location ?? '-'}</DataTableCell>
                    {!warehouseMode ? (
                      <>
                        <DataTableCell className="text-right">{formatCurrency(product.price)}</DataTableCell>
                        <DataTableCell>{product.supplier ?? '-'}</DataTableCell>
                      </>
                    ) : null}
                    {mayManageProducts ? (
                      <DataTableCell>
                        <div className="flex gap-2">
                        <Link
                          to={`/products/${product.id}/edit`}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          onClick={() => deleteMutation.mutate(product.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </button>
                        </div>
                      </DataTableCell>
                    ) : null}
                  </DataTableRow>
                ))}
              </DataTableBody>
          </DataTable>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {products.length} of {total} items shown
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={prevPage} disabled={page <= 1}>
              Previous
            </Button>
            <Button type="button" onClick={nextPage} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      </section>
    </Page>
  );
}
