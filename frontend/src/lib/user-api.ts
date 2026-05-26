import { api, type ApiEnvelope } from './api';
import type { UserRole } from './auth-store';

export type ManagedUser = {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  assigned_warehouse?: string | null;
  created_at: string;
  updated_at: string;
};

export type UserQuery = {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  page?: number;
  limit?: number;
};

export type UserCreate = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  tenant_id?: string | null;
  is_active: boolean;
  assigned_warehouse?: string | null;
};

export type UserUpdate = Partial<UserCreate>;

export async function listUsersPage(params: UserQuery) {
  const response = await api.get<ApiEnvelope<ManagedUser[]>>('/users', { params });
  return {
    users: response.data.data ?? [],
    pagination: response.data.pagination ?? {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      total: response.data.data?.length ?? 0,
    },
  };
}

export async function createUser(payload: UserCreate) {
  const response = await api.post<ApiEnvelope<ManagedUser>>('/users', payload);
  if (!response.data.data) {
    throw new Error('Create user response did not include user data.');
  }
  return response.data.data;
}

export async function updateUser(userId: string, payload: UserUpdate) {
  const response = await api.put<ApiEnvelope<ManagedUser>>(`/users/${userId}`, payload);
  if (!response.data.data) {
    throw new Error('Update user response did not include user data.');
  }
  return response.data.data;
}

export async function deleteUser(userId: string) {
  await api.delete(`/users/${userId}`);
}
