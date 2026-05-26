import type { ReactNode } from 'react';

import { Button } from '../Button';
import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  isPending,
  tone = 'danger',
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  tone?: 'danger' | 'default';
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onCancel} className="max-w-md">
      <div className="p-5">
        <p className="text-sm leading-6 text-slate-600">{description}</p>
        {children ? <div className="mt-3">{children}</div> : null}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            className={tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : undefined}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
