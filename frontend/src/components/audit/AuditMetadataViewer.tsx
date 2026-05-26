import { useState } from 'react';

export function AuditMetadataViewer({
  title,
  value,
}: {
  title: string;
  value?: Record<string, unknown> | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasValue = value && Object.keys(value).length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
        {hasValue ? (
          <button
            type="button"
            className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        ) : null}
      </div>
      {hasValue ? (
        <pre className={`overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-slate-700 ${expanded ? 'max-h-96' : 'max-h-36'}`}>
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="p-3 text-sm text-slate-500">No metadata captured.</p>
      )}
    </div>
  );
}
