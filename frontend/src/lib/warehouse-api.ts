import { api, type ApiEnvelope } from './api';

function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    return response?.data?.detail || response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export type Warehouse = {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  address?: string | null;
  manager?: string | null;
  product_count: number;
  total_units: number;
  low_stock_items: number;
  created_at: string;
  updated_at: string;
};

export type WarehouseInventoryItem = {
  id: string;
  warehouse_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  category?: string | null;
  quantity: number;
  stock_status: 'available' | 'low_stock' | 'out_of_stock';
};

export type StockTransfer = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  source_warehouse_id: string;
  source_warehouse_name: string;
  destination_warehouse_id: string;
  destination_warehouse_name: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    approved_quantity: number;
  }>;
  notes?: string | null;
  admin_notes?: string | null;
  created_at: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  completed_at?: string | null;
};

export async function listWarehouses(params?: { search?: string }) {
  const response = await api.get<ApiEnvelope<Warehouse[]>>('/warehouses', { params });
  return response.data.data ?? [];
}

export async function createWarehouse(payload: { name: string; code: string; address?: string; manager?: string }) {
  const response = await api.post<ApiEnvelope<Warehouse>>('/warehouses', payload);
  if (!response.data.data) throw new Error('Create warehouse response did not include data.');
  return response.data.data;
}

export async function listWarehouseInventory(params?: { warehouse_id?: string; search?: string }) {
  const response = await api.get<ApiEnvelope<WarehouseInventoryItem[]>>('/warehouses/inventory', { params });
  return response.data.data ?? [];
}

export async function assignWarehouseInventory(warehouseId: string, payload: { product_id: string; quantity: number }) {
  try {
    const response = await api.post<ApiEnvelope<WarehouseInventoryItem>>(`/warehouses/${warehouseId}/inventory`, payload);
    if (!response.data.data) throw new Error('Assign warehouse inventory response did not include data.');
    return response.data.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Assign stock failed.'));
  }
}

export async function listStockTransfers(params?: { status?: string }) {
  const response = await api.get<ApiEnvelope<StockTransfer[]>>('/warehouses/transfers', { params });
  return response.data.data ?? [];
}

export async function createStockTransfer(payload: {
  product_id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  quantity: number;
  notes?: string;
}) {
  try {
    const response = await api.post<ApiEnvelope<StockTransfer>>('/warehouses/transfers', payload);
    if (!response.data.data) throw new Error('Create transfer response did not include data.');
    return response.data.data;
  } catch (error) {
    throw new Error(apiErrorMessage(error, 'Create transfer request failed.'));
  }
}

export async function approveStockTransfer(transferId: string, payload?: { admin_notes?: string }) {
  const response = await api.post<ApiEnvelope<StockTransfer>>(`/warehouses/transfers/${transferId}/approve`, payload ?? {});
  if (!response.data.data) throw new Error('Approve transfer response did not include data.');
  return response.data.data;
}

export async function completeStockTransfer(transferId: string) {
  const response = await api.post<ApiEnvelope<StockTransfer>>(`/warehouses/transfers/${transferId}/complete`);
  if (!response.data.data) throw new Error('Complete transfer response did not include data.');
  return response.data.data;
}

export async function cancelStockTransfer(transferId: string, payload?: { admin_notes?: string }) {
  const response = await api.post<ApiEnvelope<StockTransfer>>(`/warehouses/transfers/${transferId}/cancel`, payload ?? {});
  if (!response.data.data) throw new Error('Cancel transfer response did not include data.');
  return response.data.data;
}
