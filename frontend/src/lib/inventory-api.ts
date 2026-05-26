import { api, type ApiEnvelope } from './api';

export type InventoryTransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT';

export type InventoryTransaction = {
  id: string;
  tenant_id: string | null;
  product_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  updated_by: string | null;
  notes?: string | null;
  created_at: string;
};

export type ProductScan = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  code: string;
  source: string;
  created_at: string;
};

export type InventoryMovementPayload = {
  product_id: string;
  quantity: number;
  notes?: string;
};

export type InventoryHistoryQuery = {
  product_id?: string;
  transaction_type?: InventoryTransactionType;
  warehouse_location?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function stockIn(payload: InventoryMovementPayload) {
  const response = await api.post<ApiEnvelope<InventoryTransaction>>('/inventory/stock-in', payload);
  if (!response.data.data) {
    throw new Error('Stock-in response did not include transaction data.');
  }
  return response.data.data;
}

export async function stockOut(payload: InventoryMovementPayload) {
  const response = await api.post<ApiEnvelope<InventoryTransaction>>('/inventory/stock-out', payload);
  if (!response.data.data) {
    throw new Error('Stock-out response did not include transaction data.');
  }
  return response.data.data;
}

export async function adjustInventory(payload: InventoryMovementPayload) {
  const response = await api.post<ApiEnvelope<InventoryTransaction>>('/inventory/adjustment', payload);
  if (!response.data.data) {
    throw new Error('Adjustment response did not include transaction data.');
  }
  return response.data.data;
}

export async function listInventoryHistory(params: InventoryHistoryQuery) {
  const response = await api.get<ApiEnvelope<InventoryTransaction[]>>('/inventory/history', { params });
  return response.data.data ?? [];
}

export async function scanProduct(code: string, source = 'manual') {
  const response = await api.post<ApiEnvelope<ProductScan>>('/inventory/scans', { code, source });
  if (!response.data.data) {
    throw new Error('Scan response did not include product data.');
  }
  return response.data.data;
}
