import { ProductBarcode } from './ProductBarcode';
import { ProductQrCode } from './ProductQrCode';
import type { Product } from '../../lib/product-api';

type ProductLabelSheetProps = {
  products: Product[];
};

export function productQrPayload(product: Product) {
  return JSON.stringify({
    type: 'ims-product',
    id: product.id,
    sku: product.sku,
    name: product.product_name,
  });
}

export function ProductLabelSheet({ products }: ProductLabelSheetProps) {
  return (
    <div className="grid gap-3 print:grid-cols-2 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="break-inside-avoid rounded-md border border-slate-200 bg-white p-3 shadow-sm print:shadow-none"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{product.product_name}</h3>
              <p className="font-mono text-xs text-slate-500">{product.sku}</p>
            </div>
            <p className="shrink-0 text-xs font-semibold text-slate-500">{product.quantity.toLocaleString()} units</p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <ProductBarcode value={product.sku} className="border-0 p-0" height={46} />
            <ProductQrCode value={productQrPayload(product)} className="border-0 p-0" size={82} />
          </div>
          <p className="mt-2 truncate text-xs text-slate-500">{product.warehouse_location || 'No warehouse assigned'}</p>
        </article>
      ))}
    </div>
  );
}
