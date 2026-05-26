import { Building2, Clock3, DatabaseZap, UsersRound } from 'lucide-react';

import { LandingContainer } from '../../components/landing/LandingContainer';
import { MetricCard } from '../../components/landing/MetricCard';

const metrics = [
  {
    icon: Building2,
    value: '120+',
    label: 'Retail locations',
    description: 'Modeled for distributed teams with separate tenant workspaces.',
  },
  {
    icon: UsersRound,
    value: '8K+',
    label: 'Users managed',
    description: 'Admins, inventory managers, and platform owners with clear boundaries.',
  },
  {
    icon: DatabaseZap,
    value: '4.8M',
    label: 'Inventory units tracked',
    description: 'Stock balances, product movement, purchase orders, and receiving events.',
  },
  {
    icon: Clock3,
    value: '99.9%',
    label: 'Workflow visibility',
    description: 'Designed for fast answers across teams, warehouses, and suppliers.',
  },
];

export function StatsSection() {
  return (
    <section className="bg-slate-50 py-16">
      <LandingContainer>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Built for multi-location businesses
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            Trusted operating patterns for modern retail inventory teams.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
