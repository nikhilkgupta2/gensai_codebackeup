import { api, type ApiEnvelope } from './api';

export type Product = {
  id: string;
  tenant_id: string | null;
  product_name: string;
  sku: string;
  category?: string | null;
  brand?: string | null;
  quantity: number;
  price?: number | null;
  supplier?: string | null;
  warehouse_location?: string | null;
  description?: string | null;
};

export type ProductQuery = {
  product_name?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  warehouse_location?: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  low_stock?: boolean;
  min_price?: number;
  max_price?: number;
  page?: number;
  limit?: number;
  offset?: number;
};

export type ProductCreate = {
  product_name: string;
  sku: string;
  category?: string;
  brand?: string;
  quantity?: number;
  price?: number;
  supplier?: string;
  warehouse_location?: string;
  description?: string;
};

export type ProductUpdate = Partial<ProductCreate>;

export async function listProducts(params: ProductQuery) {
  const response = await api.get<ApiEnvelope<Product[]>>('/products', { params });
  return response.data.data ?? [];
}

export async function listProductsPage(params: ProductQuery) {
  const response = await api.get<ApiEnvelope<Product[]>>('/products', { params });
  return {
    products: response.data.data ?? [],
    pagination: response.data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      total: response.data.data?.length ?? 0,
    },
  };
}

export async function getProduct(productId: string) {
  const response = await api.get<ApiEnvelope<Product>>(`/products/${productId}`);
  if (!response.data.data) {
    throw new Error('Product response did not include product data.');
  }
  return response.data.data;
}

export async function createProduct(payload: ProductCreate) {
  const response = await api.post<ApiEnvelope<Product>>('/products', payload);
  if (!response.data.data) {
    throw new Error('Create product response did not include product data.');
  }
  return response.data.data;
}

export async function updateProduct(productId: string, payload: ProductUpdate) {
  const response = await api.put<ApiEnvelope<Product>>(`/products/${productId}`, payload);
  if (!response.data.data) {
    throw new Error('Update product response did not include product data.');
  }
  return response.data.data;
}

export async function deleteProduct(productId: string) {
  await api.delete(`/products/${productId}`);
}
