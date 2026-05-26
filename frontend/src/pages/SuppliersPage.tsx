import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingState } from '../components/ui/LoadingState';
import { Modal } from '../components/ui/Modal';
import { Page, PageHeader, Toolbar } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  type Supplier,
  type SupplierPayload,
  updateSupplier,
} from '../lib/procurement-api';

const emptySupplier: SupplierPayload = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  status: 'active',
  notes: '',
};

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) {
      return detail;
    }
  }
  return 'Something went wrong.';
}

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalSupplier, setModalSupplier] = useState<Supplier | null | 'new'>(null);
  const [form, setForm] = useState<SupplierPayload>(emptySupplier);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const query = useQuery({
    queryKey: ['suppliers', search, statusFilter],
    queryFn: () =>
      listSuppliers({
        search: search.trim() || undefined,
        status: statusFilter === 'active' || statusFilter === 'inactive' ? statusFilter : undefined,
        limit: 50,
      }),
  });
  const suppliers = query.data?.suppliers ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        name: form.name.trim(),
        contact_name: form.contact_name?.trim() || undefined,
        contact_email: form.contact_email?.trim() || undefined,
        contact_phone: form.contact_phone?.trim() || undefined,
        address: form.address?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };
      return modalSupplier === 'new'
        ? createSupplier(payload)
        : updateSupplier((modalSupplier as Supplier).id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalSupplier(null);
      setForm(emptySupplier);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteTarget(null);
    },
  });

  const openModal = (supplier: Supplier | 'new') => {
    setModalSupplier(supplier);
    setForm(
      supplier === 'new'
        ? emptySupplier
        : {
            name: supplier.name,
            contact_name: supplier.contact_name ?? '',
            contact_email: supplier.contact_email ?? '',
            contact_phone: supplier.contact_phone ?? '',
            address: supplier.address ?? '',
            status: supplier.status,
            notes: supplier.notes ?? '',
          },
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  return (
    <Page>
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers"
        description="Manage approved supplier records, contact details, and procurement status."
        actions={
          <Button type="button" onClick={() => openModal('new')}>
            <Plus className="mr-2 h-4 w-4" /> New supplier
          </Button>
        }
      />

      <Toolbar className="mb-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <Input placeholder="Search supplier or contact" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Toolbar>

      <section>
        {query.isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <LoadingState label="Loading suppliers..." />
          </div>
        ) : query.isError ? (
          <p className="flex items-center gap-2 rounded-lg border border-red-100 bg-white p-5 text-sm text-red-600 shadow-sm">
            <AlertCircle className="h-4 w-4" /> Failed to load suppliers.
          </p>
        ) : suppliers.length === 0 ? (
          <EmptyState title="No suppliers found" description="Create supplier records to support procurement workflows." />
        ) : (
          <DataTable>
              <DataTableHeader>
                <tr>
                  <DataTableHead>Supplier</DataTableHead>
                  <DataTableHead>Contact</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead>Actions</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {suppliers.map((supplier) => (
                  <DataTableRow key={supplier.id}>
                    <DataTableCell>
                      <Link to={`/suppliers/${supplier.id}`} className="font-medium text-slate-900 underline-offset-4 hover:underline">
                        {supplier.name}
                      </Link>
                      <div className="text-xs text-slate-500">{supplier.notes ?? ''}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{supplier.contact_name ?? '-'}</div>
                      <div className="text-xs">{supplier.contact_email ?? supplier.contact_phone ?? ''}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge tone={supplier.status === 'active' ? 'green' : 'slate'} className="capitalize">
                        {supplier.status}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          onClick={() => openModal(supplier)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          onClick={() => setDeleteTarget(supplier)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
          </DataTable>
        )}
      </section>

      {modalSupplier ? (
        <Modal
          title={modalSupplier === 'new' ? 'New supplier' : 'Edit supplier'}
          description="Maintain procurement contact details and supplier status."
          onClose={() => setModalSupplier(null)}
        >
            <form className="space-y-4 p-5" onSubmit={handleSubmit}>
              {saveMutation.isError ? (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{getErrorMessage(saveMutation.error)}</p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                  <span>Name</span>
                  <Input required value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  <span>Status</span>
                  <Select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as SupplierPayload['status'] }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input placeholder="Contact name" value={form.contact_name} onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))} />
                <Input type="email" placeholder="Contact email" value={form.contact_email} onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))} />
                <Input placeholder="Contact phone" value={form.contact_phone} onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))} />
              </div>
              <textarea
                placeholder="Address"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <textarea
                placeholder="Notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <div className="flex justify-end gap-3">
                <Button type="button" className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setModalSupplier(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Saving...' : 'Save supplier'}
                </Button>
              </div>
            </form>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete supplier"
          description={`Delete or deactivate ${deleteTarget.name}?`}
          confirmLabel="Delete"
          isPending={deleteMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      ) : null}
    </Page>
  );
}
