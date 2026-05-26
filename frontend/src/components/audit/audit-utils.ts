import type { AuditLog } from '../../lib/audit-api';

export function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function auditLabel(value?: string | null) {
  if (!value) return 'System';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusFromLog(log: AuditLog) {
  const status = log.new_value?.status;
  if (typeof status === 'string') return status;
  if (['approved', 'rejected', 'cancelled', 'completed'].includes(log.action)) return log.action;
  if (log.action.includes('request')) return 'pending';
  return 'recorded';
}

export function statusTone(status: string): 'slate' | 'green' | 'amber' | 'blue' | 'red' {
  if (['approved', 'completed', 'stock_in', 'created'].includes(status)) return 'green';
  if (['rejected', 'cancelled', 'stock_out'].includes(status)) return 'red';
  if (['pending', 'approval_requested', 'transfer_requested'].includes(status)) return 'amber';
  if (['updated', 'stock_assigned'].includes(status)) return 'blue';
  return 'slate';
}

export function metadataPreview(log: AuditLog) {
  const value = log.new_value ?? log.old_value;
  if (!value || Object.keys(value).length === 0) return 'No metadata';
  const productName = value.product_name;
  const quantity = value.quantity ?? value.approved_quantity;
  const status = value.status;
  const bits = [productName, quantity !== undefined ? `${quantity} units` : null, status].filter(Boolean);
  return bits.length ? bits.join(' · ') : JSON.stringify(value);
}

export function logSearchText(log: AuditLog) {
  return [
    log.action,
    log.module,
    log.actor_name,
    log.actor_role,
    log.entity_type,
    log.entity_id,
    log.message,
    JSON.stringify(log.old_value ?? {}),
    JSON.stringify(log.new_value ?? {}),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
