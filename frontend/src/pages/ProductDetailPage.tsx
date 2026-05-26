import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Printer, ScanLine } from 'lucide-react';

import { Button } from '../components/Button';
import { ProductBarcode } from '../components/barcode/ProductBarcode';
import { ProductQrCode } from '../components/barcode/ProductQrCode';
import { productQrPayload } from '../components/barcode/ProductLabelSheet';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { DashboardGrid, Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { StatWidget } from '../components/ui/StatWidget';
import { getProduct } from '../lib/product-api';

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
  return 'Available';
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams();
  const productQuery = useQuery({
    queryKey: ['products', productId],
    queryFn: () => getProduct(productId ?? ''),
    enabled: Boolean(productId),
  });

  const product = productQuery.data;

  return (
    <Page>
      <PageHeader
        eyebrow="Inventory catalog"
        title={product?.product_name ?? 'Product details'}
        description="View product identifiers, scannable labels, and stock context for operational workflows."
        actions={
          <>
            <Button type="button" className="bg-slate-700 hover:bg-slate-600" onClick={() => navigate('/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to products
            </Button>
            {product ? (
              <>
                <Link to={`/inventory?scan=${encodeURIComponent(product.sku)}`}>
                  <Button type="button">
                    <ScanLine className="mr-2 h-4 w-4" /> Use in stock workflow
                  </Button>
                </Link>
                <Button type="button" className="bg-slate-700 hover:bg-slate-600" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print label
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {productQuery.isLoading ? (
        <LoadingState label="Loading product details..." />
      ) : productQuery.isError || !product ? (
        <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> Product details could not be loaded.
        </p>
      ) : (
        <>
          <DashboardGrid className="mb-4 xl:grid-cols-4 2xl:grid-cols-4">
            <StatWidget title="On hand" value={product.quantity.toLocaleString()} />
            <StatWidget title="SKU" value={product.sku} />
            <StatWidget title="Warehouse" value={product.warehouse_location || 'Unassigned'} />
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Stock status</p>
              <div className="mt-3">
                <Badge tone={stockTone(product.quantity)}>{stockLabel(product.quantity)}</Badge>
              </div>
            </div>
          </DashboardGrid>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <SectionCard>
              <SectionHeader title="Product profile" description="Catalog data used by inventory and warehouse workflows." />
              <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
                {[
                  ['Name', product.product_name],
                  ['SKU', product.sku],
                  ['Category', product.category || '-'],
                  ['Brand', product.brand || '-'],
                  ['Supplier', product.supplier || '-'],
                  ['Warehouse location', product.warehouse_location || '-'],
                  ['Description', product.description || '-'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard className="print:border-0 print:shadow-none">
              <SectionHeader title="Scannable labels" description="Use barcode for fast scanners and QR for mobile inventory checks." />
              <div className="space-y-4 p-4 sm:p-5">
                <ProductBarcode value={product.sku} label="Barcode" />
                <ProductQrCode value={productQrPayload(product)} label="QR code" />
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </Page>
  );
}
