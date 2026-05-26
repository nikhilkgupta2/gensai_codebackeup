import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '../ui/Badge';
import type { AuditLog } from '../../lib/audit-api';
import { AuditMetadataViewer } from './AuditMetadataViewer';
import { auditLabel, formatAuditDate, statusFromLog, statusTone } from './audit-utils';

export function AuditDetailsDrawer({
  log,
  onClose,
}: {
  log: AuditLog | null;
  onClose: () => void;
}) {
  if (!log) return null;

  const status = statusFromLog(log);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" role="dialog" aria-modal="true">
      <button className="hidden flex-1 cursor-default lg:block" type="button" aria-label="Close audit details" onClick={onClose} />
      <aside className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{auditLabel(log.module)}</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{auditLabel(log.action)}</h2>
            <p className="mt-1 text-sm text-slate-500">{log.message || auditLabel(log.entity_type)}</p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            aria-label="Close audit details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Status"><Badge tone={statusTone(status)}>{auditLabel(status)}</Badge></Detail>
            <Detail label="Timestamp">{formatAuditDate(log.created_at)}</Detail>
            <Detail label="Actor">{log.actor_name || log.actor_id || 'System'}</Detail>
            <Detail label="Actor role">{auditLabel(log.actor_role)}</Detail>
            <Detail label="Entity">{auditLabel(log.entity_type)}</Detail>
            <Detail label="Entity ID"><span className="break-all font-mono text-xs">{log.entity_id || '-'}</span></Detail>
            <Detail label="Tenant ID"><span className="break-all font-mono text-xs">{log.tenant_id || '-'}</span></Detail>
          </div>

          <div className="mt-4 grid gap-4">
            <AuditMetadataViewer title="Previous value" value={log.old_value} />
            <AuditMetadataViewer title="Updated value" value={log.new_value} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}
