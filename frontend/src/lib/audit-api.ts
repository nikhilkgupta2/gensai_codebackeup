import { api, type ApiEnvelope } from './api';

export type ApprovalQueueItem = {
  id: string;
  type: 'stock_adjustment' | 'warehouse_transfer' | 'purchase_order';
  title: string;
  description: string;
  status: string;
  requested_by?: string | null;
  requested_by_name?: string | null;
  created_at: string;
  metadata: Record<string, string | number | null | undefined>;
};

export type AuditLog = {
  id: string;
  tenant_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  module: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  message?: string | null;
  created_at: string;
};

export type StockAdjustmentRequestPayload = {
  product_id: string;
  quantity: number;
  notes?: string;
};

export async function listApprovals() {
  const response = await api.get<ApiEnvelope<ApprovalQueueItem[]>>('/approvals');
  return response.data.data ?? [];
}

export async function requestStockAdjustment(payload: StockAdjustmentRequestPayload) {
  const response = await api.post<ApiEnvelope<{ id: string; status: string }>>('/approvals/stock-adjustments', payload);
  if (!response.data.data) {
    throw new Error('Adjustment request response did not include data.');
  }
  return response.data.data;
}

export async function approveStockAdjustment(requestId: string) {
  const response = await api.post<ApiEnvelope<{ id: string; status: string }>>(`/approvals/stock-adjustments/${requestId}/approve`);
  return response.data.data;
}

export async function rejectStockAdjustment(requestId: string) {
  const response = await api.post<ApiEnvelope<{ id: string; status: string }>>(`/approvals/stock-adjustments/${requestId}/reject`);
  return response.data.data;
}

export async function listAuditLogs() {
  const response = await api.get<ApiEnvelope<AuditLog[]>>('/audit-logs');
  return response.data.data ?? [];
}
