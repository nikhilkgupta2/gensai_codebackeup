import { BarChart3, CircleDollarSign, PackageCheck } from 'lucide-react';

import { DashboardMockup } from '../../components/landing/DashboardMockup';
import { LandingContainer } from '../../components/landing/LandingContainer';
import { SectionHeading } from '../../components/landing/SectionHeading';

const highlights = [
  {
    icon: BarChart3,
    title: 'Platform analytics',
    description: 'Monitor tenants, stock pressure, purchase order status, and activity patterns.',
  },
  {
    icon: PackageCheck,
    title: 'Operational clarity',
    description: 'Retailer teams see the product and stock details they need to act quickly.',
  },
  {
    icon: CircleDollarSign,
    title: 'Procurement controls',
    description: 'Purchase orders, approvals, suppliers, and receiving stay connected to inventory.',
  },
];

export function DashboardPreviewSection() {
  return (
    <section id="analytics" className="overflow-hidden bg-slate-950 py-20 text-white">
      <LandingContainer>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Dashboard preview"
              title="A control center that feels calm under pressure."
              description="Clean reporting, practical tables, fast status indicators, and activity summaries make IMS useful for both executives and warehouse operators."
              className="text-white [&_h2]:text-white [&_p]:text-slate-300 [&_span]:text-blue-300"
            />
            <div className="mt-8 grid gap-4">
              {highlights.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-slate-950">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DashboardMockup className="border-white/10 shadow-2xl shadow-black/30" />
        </div>
      </LandingContainer>
    </section>
  );
}
