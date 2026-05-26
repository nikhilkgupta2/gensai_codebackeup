import { QRCodeSVG } from 'qrcode.react';

import { cn } from '../../lib/cn';

type ProductQrCodeProps = {
  value: string;
  label?: string;
  className?: string;
  size?: number;
};

export function ProductQrCode({ value, label, className, size = 132 }: ProductQrCodeProps) {
  return (
    <div className={cn('rounded-md border border-slate-200 bg-white p-3', className)}>
      {label ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p> : null}
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin
        className="h-auto max-w-full"
        fgColor="#020617"
        bgColor="#ffffff"
      />
    </div>
  );
}
