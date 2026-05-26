import {
  Activity,
  BellRing,
  Boxes,
  ClipboardList,
  LineChart,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import { FeatureCard } from '../../components/landing/FeatureCard';
import { LandingContainer } from '../../components/landing/LandingContainer';
import { SectionHeading } from '../../components/landing/SectionHeading';

const features = [
  {
    icon: Boxes,
    title: 'Multi-tenant inventory management',
    description: 'Separate retailer workspaces, tenant-scoped suppliers, and inventory records with clean ownership.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    description: 'Super admins, retailer admins, and inventory managers get the right permissions for their work.',
  },
  {
    icon: Activity,
    title: 'Real-time stock tracking',
    description: 'Track stock in, stock out, transfers, adjustments, and purchase receiving as they happen.',
  },
  {
    icon: LineChart,
    title: 'Inventory analytics',
    description: 'Monitor product velocity, low-stock pressure, purchase order health, and tenant-level trends.',
  },
  {
    icon: ClipboardList,
    title: 'Transaction history',
    description: 'Keep a durable operational record for quantity changes, approvals, and receiving workflows.',
  },
  {
    icon: LockKeyhole,
    title: 'Tenant isolation',
    description: 'Protect retailer data with backend-enforced authorization and privacy-aware platform views.',
  },
  {
    icon: BellRing,
    title: 'Alerts and reporting',
    description: 'Surface replenishment risks and operational exceptions before they disrupt sales.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-20">
      <LandingContainer>
        <SectionHeading
          eyebrow="Platform capabilities"
          title="Everything inventory teams need, without mixing tenant data."
          description="IMS combines day-to-day warehouse execution with SaaS-grade administration, permissions, and reporting."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </LandingContainer>
    </section>
  );
}
