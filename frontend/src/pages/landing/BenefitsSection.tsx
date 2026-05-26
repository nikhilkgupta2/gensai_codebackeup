import { CheckCircle2 } from 'lucide-react';

import { LandingContainer } from '../../components/landing/LandingContainer';
import { SectionHeading } from '../../components/landing/SectionHeading';

const benefits = [
  'Reduce stock errors with structured receiving and transaction history.',
  'Manage multiple retailers without exposing one tenant to another tenant’s data.',
  'Improve operational visibility across low-stock risk, purchasing, and supplier activity.',
  'Give each role the right level of control, from read-only inventory users to platform owners.',
];

export function BenefitsSection() {
  return (
    <section id="platform" className="bg-slate-50 py-20">
      <LandingContainer>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            align="left"
            eyebrow="Business outcomes"
            title="Less manual correction, more confident inventory decisions."
            description="IMS turns inventory management from a spreadsheet chase into governed operational workflows that teams can trust."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <p className="mt-4 text-base leading-7 text-slate-700">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
