import { api, type ApiEnvelope } from './api';

export type SupplierStatus = 'active' | 'inactive';
export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'partially_received'
  | 'completed'
  | 'cancelled';

export type Supplier = {
  id: string;
  tenant_id: string;
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  status: SupplierStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierProfile = {
  supplier: Supplier;
  total_purchase_orders: number;
  completed_purchase_orders: number;
  delayed_deliveries: number;
  total_units_received: number;
  reliability_score: number;
  delivery_history: Array<{
    purchase_order_id: string;
    po_number: string;
    status: PurchaseOrderStatus;
    expected_delivery_date?: string | null;
    created_at: string;
    total_ordered: number;
    total_received: number;
    total_amount: number;
  }>;
};

export type SupplierPayload = {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  status: SupplierStatus;
  notes?: string;
};

export type PurchaseOrderItemPayload = {
  product_id: string;
  quantity_ordered: number;
  unit_price: number;
};

export type PurchaseOrderPayload = {
  supplier_id: string;
  warehouse_id?: string;
  expected_delivery_date?: string;
  notes?: string;
  items: PurchaseOrderItemPayload[];
};

export type PurchaseOrderListItem = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  po_number: string;
  status: PurchaseOrderStatus;
  expected_delivery_date?: string | null;
  created_at: string;
  total_ordered: number;
  total_received: number;
  total_amount: number;
};

export type PurchaseOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining: number;
  unit_price: number;
  line_total: number;
};

export type PurchaseOrderAuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  details?: string | null;
  created_at: string;
};

export type PurchaseOrder = PurchaseOrderListItem & {
  tenant_id: string;
  notes?: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at?: string | null;
  updated_at: string;
  items: PurchaseOrderItem[];
  audit_logs: PurchaseOrderAuditLog[];
};

export type PurchaseOrderAnalytics = {
  total_purchase_orders: number;
  pending_purchase_orders: number;
  completed_purchase_orders: number;
  overdue_orders: number;
  supplier_activity: Array<{
    supplier_name: string;
    purchase_order_count: number;
    units_received: number;
  }>;
};

export type PageParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type SupplierQuery = PageParams & {
  status?: SupplierStatus;
};

export type PurchaseOrderQuery = PageParams & {
  status?: PurchaseOrderStatus;
  supplier_id?: string;
};

export async function listSuppliers(params: SupplierQuery = {}) {
  const response = await api.get<ApiEnvelope<Supplier[]>>('/suppliers', { params });
  return {
    suppliers: response.data.data ?? [],
    pagination: response.data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: response.data.data?.length ?? 0,
    },
  };
}

export async function createSupplier(payload: SupplierPayload) {
  const response = await api.post<ApiEnvelope<Supplier>>('/suppliers', payload);
  if (!response.data.data) {
    throw new Error('Create supplier response did not include supplier data.');
  }
  return response.data.data;
}

export async function getSupplierProfile(supplierId: string) {
  const response = await api.get<ApiEnvelope<SupplierProfile>>(`/suppliers/${supplierId}/profile`);
  if (!response.data.data) {
    throw new Error('Supplier profile response did not include data.');
  }
  return response.data.data;
}

export async function updateSupplier(supplierId: string, payload: SupplierPayload) {
  const response = await api.put<ApiEnvelope<Supplier>>(`/suppliers/${supplierId}`, payload);
  if (!response.data.data) {
    throw new Error('Update supplier response did not include supplier data.');
  }
  return response.data.data;
}

export async function deleteSupplier(supplierId: string) {
  await api.delete(`/suppliers/${supplierId}`);
}

export async function listPurchaseOrders(params: PurchaseOrderQuery = {}) {
  const response = await api.get<ApiEnvelope<PurchaseOrderListItem[]>>('/purchase-orders', { params });
  return {
    purchaseOrders: response.data.data ?? [],
    pagination: response.data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: response.data.data?.length ?? 0,
    },
  };
}

export async function getPurchaseOrder(purchaseOrderId: string) {
  const response = await api.get<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${purchaseOrderId}`);
  if (!response.data.data) {
    throw new Error('Purchase order response did not include data.');
  }
  return response.data.data;
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload) {
  const response = await api.post<ApiEnvelope<PurchaseOrder>>('/purchase-orders', payload);
  if (!response.data.data) {
    throw new Error('Create purchase order response did not include data.');
  }
  return response.data.data;
}

export async function submitPurchaseOrder(purchaseOrderId: string) {
  const response = await api.post<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${purchaseOrderId}/submit`);
  if (!response.data.data) {
    throw new Error('Submit purchase order response did not include data.');
  }
  return response.data.data;
}

export async function approvePurchaseOrder(purchaseOrderId: string) {
  const response = await api.post<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${purchaseOrderId}/approve`);
  if (!response.data.data) {
    throw new Error('Approve purchase order response did not include data.');
  }
  return response.data.data;
}

export async function cancelPurchaseOrder(purchaseOrderId: string) {
  const response = await api.post<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${purchaseOrderId}/cancel`);
  if (!response.data.data) {
    throw new Error('Cancel purchase order response did not include data.');
  }
  return response.data.data;
}

export async function receivePurchaseOrder(
  purchaseOrderId: string,
  payload: { items: Array<{ item_id: string; quantity: number }>; notes?: string },
) {
  const response = await api.post<ApiEnvelope<PurchaseOrder>>(`/purchase-orders/${purchaseOrderId}/receive`, payload);
  if (!response.data.data) {
    throw new Error('Receive purchase order response did not include data.');
  }
  return response.data.data;
}

export async function getPurchaseOrderAnalytics() {
  const response = await api.get<ApiEnvelope<PurchaseOrderAnalytics>>('/purchase-orders/analytics');
  if (!response.data.data) {
    throw new Error('Purchase order analytics response did not include data.');
  }
  return response.data.data;
}
