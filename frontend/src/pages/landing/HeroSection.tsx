import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

import { DashboardMockup } from '../../components/landing/DashboardMockup';
import { LandingButton } from '../../components/landing/LandingButton';
import { LandingContainer } from '../../components/landing/LandingContainer';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(0deg,rgba(15,23,42,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute left-1/2 top-0 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />

      <LandingContainer className="relative grid gap-12 pb-16 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:pb-20 lg:pt-20">
        <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Multi-tenant inventory, built for serious retail operations
          </div>
          <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight text-slate-950 md:text-5xl">
            Run every retailer, warehouse, and stock flow from one secure platform.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600 md:text-xl">
            IMS gives retailers and warehouse managers real-time inventory control, tenant-aware data
            boundaries, role-based access, purchase workflows, and clear operational analytics in one
            scalable SaaS workspace.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <LandingButton to="/register" variant="primary" className="h-12 px-6 text-base">
              Start managing inventory
              <ArrowRight className="h-4 w-4" />
            </LandingButton>
            <LandingButton to="/login" variant="secondary" className="h-12 px-6 text-base">
              View workspace
            </LandingButton>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            {['Tenant isolation', 'Audit-ready roles', 'Real-time stock'].map((item) => (
              <div key={item} className="flex items-center justify-center gap-2 lg:justify-start">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-slate-100/80" />
          <DashboardMockup className="relative" />
        </div>
      </LandingContainer>
    </section>
  );
}
