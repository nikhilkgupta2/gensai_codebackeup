import { BarChart3, Boxes, ClipboardCheck, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

const progressRows = [
  ['Inbound stock', '72%'],
  ['Order accuracy', '94%'],
  ['Low stock review', '18%'],
] as const;

const operationCards: Array<{ icon: ComponentType<{ className?: string }>; label: string }> = [
  { icon: Boxes, label: 'Products' },
  { icon: Truck, label: 'Receiving' },
  { icon: ClipboardCheck, label: 'Audit' },
];

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#242424] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />

      <motion.section
        initial={{ opacity: 0, y: 8, scale: 0.995 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative grid w-full max-w-[1120px] overflow-hidden rounded-md border border-white bg-black shadow-[0_18px_60px_rgba(0,0,0,0.55)] lg:min-h-[720px] lg:grid-cols-2"
      >
        <div className="flex min-h-[620px] flex-col bg-black px-6 py-7 sm:px-10 lg:px-16">
          <Link to="/" className="flex w-fit items-center gap-3 rounded-md transition hover:opacity-80" aria-label="IMS home">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-white bg-black text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight text-white">IMS</span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Inventory Cloud
              </span>
            </span>
          </Link>

          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-[360px]">
              <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-white sm:text-[1.9rem]">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/70">{description}</p>
            </div>

            <div className="mx-auto mt-7 w-full max-w-[360px]">{children}</div>

            <p className="mx-auto mt-6 w-full max-w-[360px] text-center text-sm text-white/70">{footer}</p>
          </div>
        </div>

        <aside className="relative hidden min-h-full overflow-hidden bg-black px-10 py-9 text-white lg:block">
          <div className="absolute right-0 top-0 h-40 w-40 bg-white/[0.04]" />
          <div className="absolute bottom-0 left-0 h-44 w-44 bg-white/[0.035]" />
          <div className="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:40px_40px]" />

          <div className="relative flex h-full flex-col">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Tenant-safe operations
              </div>

              <div className="mt-24">
                <div className="relative mx-auto h-[270px] max-w-[400px]">
                  <div className="absolute left-0 top-0 w-[292px] rounded-md border border-white/10 bg-white/[0.06] p-4 text-white shadow-xl shadow-black/50">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <p className="text-sm font-semibold">Inventory overview</p>
                        <p className="text-xs text-white/60">Operational stock signal</p>
                      </div>
                      <PackageCheck className="h-4 w-4 text-white/60" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {progressRows.map(([label, value]) => (
                        <div key={label}>
                          <div className="mb-1 flex justify-between text-[11px] font-medium text-white/60">
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className="h-1.5 rounded-full bg-white/70" style={{ width: value }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="absolute right-0 top-[92px] w-[176px] rounded-md border border-white/10 bg-white/[0.06] p-4 text-white shadow-xl shadow-black/50">
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border-[14px] border-white/10 border-r-white/70">
                      <div className="text-center">
                        <p className="text-[11px] text-white/60">Ready</p>
                        <p className="text-lg font-semibold">42%</p>
                      </div>
                    </div>
                    <p className="mt-3 text-center text-xs font-medium text-white/60">Stock readiness</p>
                  </div>

                  <div className="absolute bottom-0 left-12 grid w-[270px] grid-cols-3 gap-2">
                    {operationCards.map(({ icon: Icon, label }) => (
                      <div key={label} className="rounded-md border border-white/10 bg-white/[0.08] p-3 text-center">
                        <Icon className="mx-auto h-4 w-4 text-slate-300" />
                        <p className="mt-2 text-[11px] font-medium text-slate-300">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pb-8 text-center">
              <h2 className="mx-auto max-w-md text-xl font-semibold tracking-tight">
                A simple way to control daily inventory operations.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
                Track products, receive stock, and manage tenant-safe inventory records from one focused workspace.
              </p>
            </div>
          </div>
        </aside>
      </motion.section>
    </main>
  );
}
