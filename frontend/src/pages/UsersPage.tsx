import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Page, PageHeader, SectionHeader, Toolbar } from '../components/ui/Page';
import { useAuthStore, type UserRole } from '../lib/auth-store';
import { cn } from '../lib/cn';
import {
  createUser,
  deleteUser,
  listUsersPage,
  type ManagedUser,
  type UserCreate,
  type UserQuery,
  updateUser,
} from '../lib/user-api';

const DEFAULT_PAGE_SIZE = 10;

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  retailer_admin: 'Retailer Admin',
  inventory_manager: 'Inventory Manager',
  warehouse_staff: 'Warehouse Staff',
  auditor: 'Auditor',
  procurement_manager: 'Procurement Manager',
};

const userSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters.'),
    email: z.string().email('Enter a valid email address.'),
    password: z.string().optional(),
    role: z.enum(['super_admin', 'retailer_admin', 'inventory_manager', 'warehouse_staff', 'auditor', 'procurement_manager']),
    tenant_id: z.string().optional(),
    is_active: z.boolean(),
    assigned_warehouse: z.string().max(255, 'Warehouse name is too long.').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'super_admin' && value.tenant_id !== undefined && value.tenant_id.trim().length > 0) {
      const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidLike.test(value.tenant_id.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tenant_id'],
          message: 'Tenant ID must be a valid UUID.',
        });
      }
    }
  });

type UserFormData = z.infer<typeof userSchema>;

type UserModalState =
  | { mode: 'create'; user?: undefined }
  | { mode: 'edit'; user: ManagedUser }
  | null;

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) {
      return detail;
    }
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function buildPayload(values: UserFormData, currentRole: UserRole, mode: 'create' | 'edit'): Partial<UserCreate> {
  const payload: Partial<UserCreate> = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    role: values.role,
    is_active: values.is_active,
    password: values.password?.trim() ?? '',
    assigned_warehouse: values.role === 'warehouse_staff' ? values.assigned_warehouse?.trim() || null : null,
  };
  if (currentRole === 'super_admin') {
    payload.tenant_id = values.role === 'super_admin' ? null : values.tenant_id?.trim() || null;
  }
  if (mode === 'edit' && !payload.password) {
    delete payload.password;
  }
  return payload;
}

function roleBadgeClass(role: UserRole) {
  if (role === 'super_admin') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (role === 'retailer_admin') {
    return 'border-sky-200 bg-sky-50 text-sky-700';
  }
  if (role === 'warehouse_staff') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  if (role === 'auditor') {
    return 'border-violet-200 bg-violet-50 text-violet-700';
  }
  if (role === 'procurement_manager') {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

function UserFormModal({
  state,
  currentRole,
  currentTenantId,
  onClose,
  onSubmit,
  isSaving,
  error,
}: {
  state: UserModalState;
  currentRole: UserRole;
  currentTenantId: string | null;
  onClose: () => void;
  onSubmit: (values: UserFormData, mode: 'create' | 'edit') => void;
  isSaving: boolean;
  error: string | null;
}) {
  const isEdit = state?.mode === 'edit';
  const user = state?.mode === 'edit' ? state.user : null;
  const roleOptions: UserRole[] =
    currentRole === 'super_admin'
      ? ['warehouse_staff', 'inventory_manager', 'procurement_manager', 'auditor', 'retailer_admin', 'super_admin']
      : ['warehouse_staff', 'inventory_manager', 'procurement_manager', 'auditor', 'retailer_admin'];

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    values: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      role: user?.role ?? 'inventory_manager',
      tenant_id: user?.tenant_id ?? currentTenantId ?? '',
      is_active: user?.is_active ?? true,
      assigned_warehouse: user?.assigned_warehouse ?? '',
    },
  });
  const watchedRole = form.watch('role');

  if (!state) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{isEdit ? 'Edit user' : 'New user'}</h2>
            <p className="text-sm text-slate-500">Manage access without changing the login system.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Close user form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="space-y-4 p-5" onSubmit={form.handleSubmit((values) => onSubmit(values, state.mode))}>
          {error ? (
            <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Name</span>
              <Input {...form.register('name')} />
              {form.formState.errors.name ? (
                <span className="block text-xs font-normal text-red-600">{form.formState.errors.name.message}</span>
              ) : null}
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Email</span>
              <Input type="email" {...form.register('email')} />
              {form.formState.errors.email ? (
                <span className="block text-xs font-normal text-red-600">{form.formState.errors.email.message}</span>
              ) : null}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>{isEdit ? 'New password' : 'Password'}</span>
              <Input
                type="password"
                {...form.register('password', {
                  validate: (value) => {
                    if (isEdit && !value) {
                      return true;
                    }
                    return value && value.length >= 8 ? true : 'Password must be at least 8 characters.';
                  },
                })}
              />
              {form.formState.errors.password ? (
                <span className="block text-xs font-normal text-red-600">{form.formState.errors.password.message}</span>
              ) : null}
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Role</span>
              <select
                {...form.register('role')}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {currentRole === 'super_admin' && watchedRole !== 'super_admin' ? (
            <label className="block space-y-2 text-sm font-medium">
              <span>Tenant ID</span>
              <Input {...form.register('tenant_id')} />
              {form.formState.errors.tenant_id ? (
                <span className="block text-xs font-normal text-red-600">{form.formState.errors.tenant_id.message}</span>
              ) : null}
            </label>
          ) : null}

          {watchedRole === 'warehouse_staff' ? (
            <label className="block space-y-2 text-sm font-medium">
              <span>Assigned warehouse</span>
              <Input {...form.register('assigned_warehouse')} placeholder="Warehouse A" />
              <span className="block text-xs font-normal text-slate-500">
                Warehouse Staff can only view and move stock for this exact warehouse location.
              </span>
              {form.formState.errors.assigned_warehouse ? (
                <span className="block text-xs font-normal text-red-600">
                  {form.formState.errors.assigned_warehouse.message}
                </span>
              ) : null}
            </label>
          ) : null}

          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              {...form.register('is_active')}
              className="h-4 w-4 rounded border-slate-300 text-slate-950"
            />
            Active account
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function UsersPage() {
  const [searchParams, setSearchParams] = useState({ search: '', role: '', is_active: '' });
  const [appliedFilters, setAppliedFilters] = useState({ search: '', role: '', is_active: '' });
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState<UserModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const setCurrentUser = useAuthStore((state) => state.setUser);
  const canManageUsers = currentUser?.role === 'super_admin' || currentUser?.role === 'retailer_admin';

  const queryParams: UserQuery = useMemo(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      role: (appliedFilters.role as UserRole) || undefined,
      is_active: appliedFilters.is_active === '' ? undefined : appliedFilters.is_active === 'true',
      page,
      limit: DEFAULT_PAGE_SIZE,
    }),
    [appliedFilters, page],
  );

  const { data, isError, isLoading } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: () => listUsersPage(queryParams),
  });
  const users = data?.users ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setNotice('User created successfully.');
      setModalState(null);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Partial<UserCreate> }) => updateUser(userId, payload),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (updatedUser.id === currentUser?.id) {
        setCurrentUser(updatedUser);
      }
      setNotice('User updated successfully.');
      setModalState(null);
      setFormError(null);
    },
    onError: (error) => setFormError(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setNotice('User deleted successfully.');
      setDeleteTarget(null);
    },
  });

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(searchParams);
  };

  const resetFilters = () => {
    const emptyFilters = { search: '', role: '', is_active: '' };
    setSearchParams(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const submitUserForm = (values: UserFormData, mode: 'create' | 'edit') => {
    if (!currentUser) {
      return;
    }
    setFormError(null);
    const payload = buildPayload(values, currentUser.role, mode);
    if (mode === 'create') {
      createMutation.mutate(payload as UserCreate);
    } else if (modalState?.mode === 'edit') {
      updateMutation.mutate({ userId: modalState.user.id, payload });
    }
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Access control"
        title="Users"
        description={canManageUsers ? 'Manage tenant access, account status, and role assignment.' : 'View users in your tenant.'}
        actions={canManageUsers ? (
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              setModalState({ mode: 'create' });
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> New user
          </Button>
        ) : null}
      />

      {notice ? (
        <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="font-medium">
            Dismiss
          </button>
        </div>
      ) : null}

      <Toolbar className="mb-5">
        <form className="grid gap-4 md:grid-cols-[1fr_180px_160px_auto] md:items-end" onSubmit={applyFilters}>
          <label className="space-y-2 text-sm font-medium">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Name or email"
                value={searchParams.search}
                onChange={(event) => setSearchParams((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Role</span>
            <select
              value={searchParams.role}
              onChange={(event) => setSearchParams((prev) => ({ ...prev, role: event.target.value }))}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Any role</option>
              <option value="super_admin">Super Admin</option>
              <option value="retailer_admin">Retailer Admin</option>
              <option value="inventory_manager">Inventory Manager</option>
              <option value="warehouse_staff">Warehouse Staff</option>
              <option value="procurement_manager">Procurement Manager</option>
              <option value="auditor">Auditor</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            <span>Status</span>
            <select
              value={searchParams.is_active}
              onChange={(event) => setSearchParams((prev) => ({ ...prev, is_active: event.target.value }))}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="">Any status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <div className="flex gap-2">
            <Button type="submit">Apply</Button>
            <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={resetFilters}>
              Reset
            </Button>
          </div>
        </form>
      </Toolbar>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="User list"
          description={`${total.toLocaleString()} accounts match the current filters.`}
          actions={<p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>}
        />

        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="flex items-center gap-2 p-5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" /> Failed to load users.
          </p>
        ) : users.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No users found" description="Adjust filters or create a user when you have permission." />
          </div>
        ) : (
          <DataTable className="rounded-none border-x-0 border-b-0 shadow-none">
              <DataTableHeader>
                <tr>
                  <DataTableHead>Name</DataTableHead>
                  <DataTableHead>Email</DataTableHead>
                  <DataTableHead>Role</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Warehouse</DataTableHead>
                  {currentUser?.role === 'super_admin' ? (
                    <DataTableHead>Tenant</DataTableHead>
                  ) : null}
                  {canManageUsers ? <DataTableHead>Actions</DataTableHead> : null}
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <DataTableRow key={user.id}>
                      <DataTableCell className="text-slate-900">
                        <div className="font-medium">{user.name}</div>
                        {isSelf ? <div className="text-xs text-slate-500">Current session</div> : null}
                      </DataTableCell>
                      <DataTableCell>{user.email}</DataTableCell>
                      <DataTableCell>
                        <span className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-medium', roleBadgeClass(user.role))}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <Badge tone={user.is_active ? 'green' : 'slate'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell className="max-w-[180px] truncate">
                        {user.role === 'warehouse_staff' ? user.assigned_warehouse || 'Unassigned' : 'All assigned access'}
                      </DataTableCell>
                      {currentUser?.role === 'super_admin' ? (
                        <DataTableCell className="max-w-[220px] truncate">{user.tenant_id ?? 'System'}</DataTableCell>
                      ) : null}
                      {canManageUsers ? (
                        <DataTableCell>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setFormError(null);
                                setModalState({ mode: 'edit', user });
                              }}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        </DataTableCell>
                      ) : null}
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
          </DataTable>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
          <p className="text-sm text-slate-500">
            {users.length} of {total} users shown
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button type="button" onClick={() => setPage((current) => current + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <UserFormModal
        state={modalState}
        currentRole={currentUser?.role ?? 'inventory_manager'}
        currentTenantId={currentUser?.tenant_id ?? null}
        onClose={() => setModalState(null)}
        onSubmit={submitUserForm}
        isSaving={createMutation.isPending || updateMutation.isPending}
        error={formError}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Delete user</h2>
            <p className="mt-2 text-sm text-slate-600">
              Delete {deleteTarget.name}? This removes their account access immediately.
            </p>
            {deleteMutation.isError ? (
              <p className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" /> {getErrorMessage(deleteMutation.error)}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-500"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete user'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </Page>
  );
}
