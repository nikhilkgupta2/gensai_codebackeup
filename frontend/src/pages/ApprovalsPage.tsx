import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ClipboardCheck, X } from 'lucide-react';

import { Button } from '../components/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { approveStockAdjustment, listApprovals, rejectStockAdjustment, type ApprovalQueueItem } from '../lib/audit-api';
import { approveStockTransfer, cancelStockTransfer } from '../lib/warehouse-api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function typeLabel(type: ApprovalQueueItem['type']) {
  return type.replace('_', ' ');
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const approvalsQuery = useQuery({
    queryKey: ['approvals'],
    queryFn: listApprovals,
  });

  const approveMutation = useMutation({
    mutationFn: approveStockAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: rejectStockAdjustment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });
  const transferMutation = useMutation({
    mutationFn: ({ transferId, action, adminNotes }: { transferId: string; action: 'approve' | 'reject'; adminNotes?: string }) => {
      if (action === 'approve') return approveStockTransfer(transferId, { admin_notes: adminNotes });
      return cancelStockTransfer(transferId, { admin_notes: adminNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const approvals = approvalsQuery.data ?? [];

  return (
    <Page>
      <PageHeader
        eyebrow="Controls"
        title="Approval queue"
        description="Review pending stock adjustment, warehouse transfer, and purchase order approvals."
      />

      <SectionCard>
        <SectionHeader title="Pending approvals" description={`${approvals.length.toLocaleString()} item${approvals.length === 1 ? '' : 's'} awaiting review.`} />
        {approvalsQuery.isLoading ? (
          <div className="p-5">
            <LoadingState label="Loading approval queue..." />
          </div>
        ) : approvalsQuery.isError ? (
          <p className="flex items-center gap-2 p-5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> Approval queue could not be loaded.
          </p>
        ) : approvals.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No pending approvals" description="Approval requests will appear here when operational users submit controlled actions." />
          </div>
        ) : (
          <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
            <DataTableHeader>
              <tr>
                <DataTableHead>Request</DataTableHead>
                <DataTableHead>Type</DataTableHead>
                <DataTableHead>Requested by</DataTableHead>
                <DataTableHead>Created</DataTableHead>
                <DataTableHead>Actions</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {approvals.map((item) => (
                <DataTableRow key={`${item.type}-${item.id}`}>
                  <DataTableCell>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.description}</p>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={item.type === 'stock_adjustment' ? 'amber' : item.type === 'warehouse_transfer' ? 'blue' : 'green'}>
                      {typeLabel(item.type)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>{item.requested_by_name || item.requested_by || 'System'}</DataTableCell>
                  <DataTableCell>{formatDate(item.created_at)}</DataTableCell>
                  <DataTableCell>
                    {item.type === 'stock_adjustment' ? (
                      <div className="flex gap-2">
                        <Button type="button" className="h-8 px-3" onClick={() => approveMutation.mutate(item.id)}>
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-slate-700 px-3 hover:bg-slate-600"
                          onClick={() => rejectMutation.mutate(item.id)}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : item.type === 'warehouse_transfer' ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="h-8 px-3"
                          disabled={transferMutation.isPending}
                          onClick={() => {
                            const adminNotes = window.prompt('Admin notes for approval (optional)') || undefined;
                            transferMutation.mutate({ transferId: item.id, action: 'approve', adminNotes });
                          }}
                        >
                          <Check className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button
                          type="button"
                          className="h-8 bg-slate-700 px-3 hover:bg-slate-600"
                          disabled={transferMutation.isPending}
                          onClick={() => {
                            const adminNotes = window.prompt('Reason for rejection (optional)') || undefined;
                            transferMutation.mutate({ transferId: item.id, action: 'reject', adminNotes });
                          }}
                        >
                          <X className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                        <ClipboardCheck className="h-4 w-4" /> Review in source module
                      </span>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </SectionCard>
    </Page>
  );
}
