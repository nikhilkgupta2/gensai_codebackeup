import { api, type ApiEnvelope } from './api';

export type ImportType = 'products' | 'suppliers' | 'warehouse_inventory';
export type DuplicateStrategy = 'skip' | 'update';

export type ImportErrorItem = {
  row: number;
  field?: string | null;
  message: string;
};

export type ImportPreview = {
  import_type: ImportType;
  total_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  error_rows: number;
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  errors: ImportErrorItem[];
};

export type ImportApplyResult = {
  import_type: ImportType;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportErrorItem[];
};

export type ImportTemplate = {
  label: string;
  href: string;
  import_type: ImportType;
  description: string;
};

export async function listImportTemplates() {
  const response = await api.get<ApiEnvelope<{ templates: ImportTemplate[] }>>('/imports/templates');
  return response.data.data?.templates ?? [];
}

function csvForm(file: File) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export async function previewImport(importType: ImportType, file: File) {
  const response = await api.post<ApiEnvelope<ImportPreview>>(
    `/imports/${importType}/preview`,
    csvForm(file),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  if (!response.data.data) throw new Error('Import preview response did not include data.');
  return response.data.data;
}

export async function applyImport(importType: ImportType, file: File, duplicateStrategy: DuplicateStrategy) {
  const form = csvForm(file);
  form.append('duplicate_strategy', duplicateStrategy);
  const response = await api.post<ApiEnvelope<ImportApplyResult>>(
    `/imports/${importType}/apply`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  if (!response.data.data) throw new Error('Import apply response did not include data.');
  return response.data.data;
}
