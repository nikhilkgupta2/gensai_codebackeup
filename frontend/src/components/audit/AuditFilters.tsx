import { Search } from 'lucide-react';

import { Input } from '../Input';
import { Select } from '../ui/Select';

export type AuditFilterState = {
  search: string;
  module: string;
  action: string;
  status: string;
  actorRole: string;
  date: string;
};

export function AuditFilters({
  filters,
  modules,
  actions,
  actorRoles,
  onChange,
  onReset,
}: {
  filters: AuditFilterState;
  modules: string[];
  actions: string[];
  actorRoles: string[];
  onChange: (filters: AuditFilterState) => void;
  onReset: () => void;
}) {
  return (
    <div className="grid gap-3 border-b border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-[minmax(260px,1.6fr)_repeat(5,minmax(140px,1fr))_auto]">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search user, product, action, metadata"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>
      <Select value={filters.module} onChange={(event) => onChange({ ...filters, module: event.target.value })}>
        <option value="">All modules</option>
        {modules.map((module) => <option key={module} value={module}>{module}</option>)}
      </Select>
      <Select value={filters.action} onChange={(event) => onChange({ ...filters, action: event.target.value })}>
        <option value="">All actions</option>
        {actions.map((action) => <option key={action} value={action}>{action}</option>)}
      </Select>
      <Select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}>
        <option value="">All statuses</option>
        {['pending', 'approved', 'rejected', 'cancelled', 'completed', 'recorded'].map((status) => <option key={status} value={status}>{status}</option>)}
      </Select>
      <Select value={filters.actorRole} onChange={(event) => onChange({ ...filters, actorRole: event.target.value })}>
        <option value="">All roles</option>
        {actorRoles.map((role) => <option key={role} value={role}>{role}</option>)}
      </Select>
      <Input type="date" value={filters.date} onChange={(event) => onChange({ ...filters, date: event.target.value })} />
      <button
        type="button"
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  );
}
