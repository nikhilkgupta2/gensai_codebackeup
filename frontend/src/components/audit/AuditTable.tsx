import { Eye } from 'lucide-react';

import { Badge } from '../ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../ui/DataTable';
import type { AuditLog } from '../../lib/audit-api';
import { auditLabel, formatAuditDate, metadataPreview, statusFromLog, statusTone } from './audit-utils';

export function AuditTable({
  logs,
  onSelect,
}: {
  logs: AuditLog[];
  onSelect: (log: AuditLog) => void;
}) {
  return (
    <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact">
      <DataTableHeader>
        <tr>
          <DataTableHead className="w-[190px]">Action</DataTableHead>
          <DataTableHead className="w-[120px]">Status</DataTableHead>
          <DataTableHead className="w-[130px]">Module</DataTableHead>
          <DataTableHead className="w-[180px]">Actor</DataTableHead>
          <DataTableHead className="min-w-[260px]">Summary</DataTableHead>
          <DataTableHead className="w-[180px]">Time</DataTableHead>
          <DataTableHead className="w-[110px] text-right">Details</DataTableHead>
        </tr>
      </DataTableHeader>
      <DataTableBody>
        {logs.map((log) => {
          const status = statusFromLog(log);
          return (
            <DataTableRow key={log.id} className="odd:bg-slate-50/30">
              <DataTableCell className="max-w-[190px] whitespace-normal">
                <p className="font-semibold text-slate-900">{auditLabel(log.action)}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{auditLabel(log.entity_type)}</p>
              </DataTableCell>
              <DataTableCell>
                <Badge tone={statusTone(status)}>{auditLabel(status)}</Badge>
              </DataTableCell>
              <DataTableCell>
                <Badge tone="blue">{auditLabel(log.module)}</Badge>
              </DataTableCell>
              <DataTableCell className="max-w-[180px] whitespace-normal">
                <p className="truncate font-medium text-slate-800">{log.actor_name || 'System'}</p>
                <p className="truncate text-xs text-slate-500">{auditLabel(log.actor_role)}</p>
              </DataTableCell>
              <DataTableCell className="min-w-[260px] max-w-[420px] whitespace-normal">
                <p className="line-clamp-2 text-sm text-slate-700">{log.message || metadataPreview(log)}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{metadataPreview(log)}</p>
              </DataTableCell>
              <DataTableCell>{formatAuditDate(log.created_at)}</DataTableCell>
              <DataTableCell className="text-right">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
                  onClick={() => onSelect(log)}
                >
                  <Eye className="h-3.5 w-3.5" /> View
                </button>
              </DataTableCell>
            </DataTableRow>
          );
        })}
      </DataTableBody>
    </DataTable>
  );
}
