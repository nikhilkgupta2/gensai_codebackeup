import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

import { cn } from '../../lib/cn';

type ProductBarcodeProps = {
  value: string;
  label?: string;
  className?: string;
  height?: number;
};

export function ProductBarcode({ value, label, className, height = 64 }: ProductBarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value.trim()) {
      return;
    }
    JsBarcode(svgRef.current, value, {
      format: 'CODE128',
      displayValue: true,
      font: 'monospace',
      fontSize: 13,
      height,
      margin: 8,
      width: 1.4,
    });
  }, [height, value]);

  return (
    <div className={cn('rounded-md border border-slate-200 bg-white p-3', className)}>
      {label ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p> : null}
      <svg ref={svgRef} className="h-auto max-w-full" aria-label={`Barcode for ${value}`} role="img" />
    </div>
  );
}
