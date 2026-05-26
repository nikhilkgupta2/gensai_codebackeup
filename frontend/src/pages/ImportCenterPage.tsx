import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, UploadCloud } from 'lucide-react';

import { Button } from '../components/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Page, PageHeader, SectionCard, SectionHeader } from '../components/ui/Page';
import { Select } from '../components/ui/Select';
import {
  applyImport,
  listImportTemplates,
  previewImport,
  type DuplicateStrategy,
  type ImportPreview,
  type ImportType,
} from '../lib/import-api';

const importOptions: Array<{ value: ImportType; label: string; description: string }> = [
  { value: 'products', label: 'Products', description: 'Create or update product catalog records.' },
  { value: 'suppliers', label: 'Suppliers', description: 'Create or update supplier profiles.' },
  { value: 'warehouse_inventory', label: 'Warehouse inventory', description: 'Assign existing SKUs to warehouse codes.' },
];

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail || 'Import request failed.';
  }
  return error instanceof Error ? error.message : 'Import request failed.';
}

export function ImportCenterPage() {
  const queryClient = useQueryClient();
  const [importType, setImportType] = useState<ImportType>('products');
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['import-templates'],
    queryFn: listImportTemplates,
  });

  const previewMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a CSV file first.');
      return previewImport(importType, file);
    },
    onSuccess: setPreview,
  });

  const applyMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Choose a CSV file first.');
      return applyImport(importType, file, duplicateStrategy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const selectedOption = importOptions.find((option) => option.value === importType) ?? importOptions[0];
  const templates = templatesQuery.data ?? [];
  const selectedTemplates = useMemo(
    () => templates.filter((template) => template.import_type === importType),
    [importType, templates],
  );
  const sampleRows = preview?.rows.slice(0, 8) ?? [];
  const canApply = Boolean(preview && preview.error_rows === 0 && file);

  return (
    <Page>
      <PageHeader
        eyebrow="Onboarding"
        title="Import center"
        description="Load starter product, supplier, and warehouse inventory CSVs with validation before records are created."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <div className="space-y-4">
          <SectionCard>
            <SectionHeader title="Import setup" description="Choose the record type, upload CSV, then preview before applying." />
            <div className="space-y-4 p-4 sm:p-5">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Import type</span>
                <Select
                  className="h-11"
                  value={importType}
                  onChange={(event) => {
                    setImportType(event.target.value as ImportType);
                    setPreview(null);
                  }}
                >
                  {importOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <span className="block text-xs font-normal text-slate-500">{selectedOption.description}</span>
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Duplicate handling</span>
                <Select
                  className="h-11"
                  value={duplicateStrategy}
                  onChange={(event) => setDuplicateStrategy(event.target.value as DuplicateStrategy)}
                >
                  <option value="skip">Skip existing records</option>
                  <option value="update">Update existing records</option>
                </Select>
              </label>

              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-slate-400 hover:bg-white">
                <UploadCloud className="h-8 w-8 text-slate-500" />
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  {file ? file.name : 'Upload CSV file'}
                </span>
                <span className="mt-1 text-xs text-slate-500">UTF-8 CSV, up to 1000 rows</span>
                <input
                  className="sr-only"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setPreview(null);
                    applyMutation.reset();
                    previewMutation.reset();
                  }}
                />
              </label>

              {previewMutation.isError ? (
                <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {errorMessage(previewMutation.error)}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="h-11 flex-1"
                  disabled={!file || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  {previewMutation.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                  Preview
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 bg-slate-700 hover:bg-slate-600"
                  disabled={!canApply || applyMutation.isPending}
                  onClick={() => applyMutation.mutate()}
                >
                  {applyMutation.isPending ? 'Importing...' : 'Apply import'}
                </Button>
              </div>

              {applyMutation.data ? (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4" />
                    Import processed
                  </div>
                  <p className="mt-1">
                    Created {applyMutation.data.created}, updated {applyMutation.data.updated}, skipped {applyMutation.data.skipped}.
                  </p>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader title="Templates and starter data" description="Download clean CSVs for onboarding." />
            {templatesQuery.isLoading ? (
              <div className="p-5"><LoadingState label="Loading templates..." /></div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(selectedTemplates.length ? selectedTemplates : templates).map((template) => (
                  <a
                    key={template.href}
                    href={template.href}
                    download
                    className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">{template.label}</span>
                      <span className="mt-1 block text-xs text-slate-500">{template.description}</span>
                    </span>
                    <Download className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  </a>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard className="min-w-0">
          <SectionHeader
            title="Import preview"
            description={preview ? `${preview.valid_rows} valid of ${preview.total_rows} rows` : 'Preview validates headers, duplicates, and row-level errors.'}
            actions={preview ? <Badge tone={preview.error_rows > 0 ? 'red' : preview.duplicate_rows > 0 ? 'amber' : 'green'}>{preview.error_rows} errors</Badge> : null}
          />
          {!preview ? (
            <div className="p-5">
              <EmptyState title="No preview yet" description="Upload a CSV and run preview to inspect rows before importing." />
            </div>
          ) : (
            <>
              <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
                <PreviewMetric label="Rows" value={preview.total_rows} />
                <PreviewMetric label="Valid" value={preview.valid_rows} tone="green" />
                <PreviewMetric label="Duplicates" value={preview.duplicate_rows} tone="amber" />
                <PreviewMetric label="Errors" value={preview.error_rows} tone="red" />
              </div>

              {preview.errors.length > 0 ? (
                <div className="border-b border-slate-200 bg-red-50/70 p-4">
                  <p className="mb-2 text-sm font-semibold text-red-800">Validation issues</p>
                  <div className="space-y-1">
                    {preview.errors.slice(0, 8).map((error) => (
                      <p key={`${error.row}-${error.field}-${error.message}`} className="text-xs text-red-700">
                        Row {error.row}{error.field ? `, ${error.field}` : ''}: {error.message}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {sampleRows.length === 0 ? (
                <div className="p-5">
                  <EmptyState title="No rows available" description="The CSV did not produce preview rows." />
                </div>
              ) : (
                <DataTable className="rounded-none border-x-0 border-b-0 shadow-none" density="compact" minWidth="min-w-[900px]">
                  <DataTableHeader>
                    <tr>
                      {preview.headers.slice(0, 9).map((header) => (
                        <DataTableHead key={header}>{header.replace(/_/g, ' ')}</DataTableHead>
                      ))}
                      <DataTableHead>Status</DataTableHead>
                    </tr>
                  </DataTableHeader>
                  <DataTableBody>
                    {sampleRows.map((row, index) => (
                      <DataTableRow key={index}>
                        {preview.headers.slice(0, 9).map((header) => (
                          <DataTableCell key={header} className="max-w-[220px] truncate">
                            {String(row[header] ?? '-')}
                          </DataTableCell>
                        ))}
                        <DataTableCell>
                          {row.duplicate ? <Badge tone="amber">Duplicate</Badge> : <Badge tone="green">Ready</Badge>}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </Page>
  );
}

function PreviewMetric({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'green' | 'amber' | 'red' }) {
  const toneClass =
    tone === 'green'
      ? 'text-green-700'
      : tone === 'amber'
        ? 'text-amber-700'
        : tone === 'red'
          ? 'text-red-700'
          : 'text-slate-900';
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}
