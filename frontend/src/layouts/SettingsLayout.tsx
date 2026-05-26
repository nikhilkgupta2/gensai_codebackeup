import type { ReactNode } from 'react';

export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Settings sections will appear here as system configuration is expanded.
      </aside>
      <section>{children}</section>
    </div>
  );
}
