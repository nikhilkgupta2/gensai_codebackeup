import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

import { AuditDetailsDrawer } from '../components/audit/AuditDetailsDrawer';
import { AuditFilters, type AuditFilterState } from '../components/audit/AuditFilters';
import { AuditTable } from '../components/audit/AuditTable';
import { logSearchText, statusFromLog } from '../components/audit/audit-utils';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { listAuditLogs, type AuditLog } from '../lib/audit-api';

const emptyFilters: AuditFilterState = {
  search: '',
  module: '',
  action: '',
  status: '',
  actorRole: '',
  date: '',
};

const pageSize = 12;

export function AuditLogsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: listAuditLogs,
  });
  const logs = logsQuery.data ?? [];

  const modules = useMemo(() => distinct(logs.map((log) => log.module)), [logs]);
  const actions = useMemo(() => distinct(logs.map((log) => log.action)), [logs]);
  const actorRoles = useMemo(() => distinct(logs.map((log) => log.actor_role).filter(Boolean) as string[]), [logs]);

  const filteredLogs = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return logs.filter((log) => {
      if (search && !logSearchText(log).includes(search)) return false;
      if (filters.module && log.module !== filters.module) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.status && statusFromLog(log) !== filters.status) return false;
      if (filters.actorRole && log.actor_role !== filters.actorRole) return false;
      if (filters.date && log.created_at.slice(0, 10) !== filters.date) return false;
      return true;
    });
  }, [filters, logs]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateFilters = (nextFilters: AuditFilterState) => {
    setFilters(nextFilters);
    setPage(1);
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Compliance"
        title="Audit logs"
        description="Read-only operational timeline with searchable metadata, actor context, and transfer/stock lifecycle details."
      />

      <SectionCard className="overflow-hidden">
        <SectionHeader
          title="Audit timeline"
          description={`${filteredLogs.length.toLocaleString()} of ${logs.length.toLocaleString()} audit event${logs.length === 1 ? '' : 's'} shown.`}
        />
        <AuditFilters
          filters={filters}
          modules={modules}
          actions={actions}
          actorRoles={actorRoles}
          onChange={updateFilters}
          onReset={() => updateFilters(emptyFilters)}
        />

        {logsQuery.isLoading ? (
          <div className="p-5">
            <LoadingState label="Loading audit logs..." />
          </div>
        ) : logsQuery.isError ? (
          <p className="flex items-center gap-2 p-5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> Audit logs could not be loaded.
          </p>
        ) : logs.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No audit events yet" description="Approvals and controlled actions will appear here." />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No matching audit events" description="Adjust filters or clear search to see more activity." />
          </div>
        ) : (
          <>
            <AuditTable logs={visibleLogs} onSelect={setSelectedLog} />
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Page {currentPage} of {pageCount} · showing {visibleLogs.length.toLocaleString()} rows
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 font-semibold transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <AuditDetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Page>
  );
}

function distinct(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
