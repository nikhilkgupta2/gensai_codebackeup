import { BenefitsSection } from './landing/BenefitsSection';
import { CtaSection } from './landing/CtaSection';
import { DashboardPreviewSection } from './landing/DashboardPreviewSection';
import { FeaturesSection } from './landing/FeaturesSection';
import { HeroSection } from './landing/HeroSection';
import { LandingFooter } from './landing/LandingFooter';
import { LandingNavbar } from './landing/LandingNavbar';
import { StatsSection } from './landing/StatsSection';
import { TestimonialsSection } from './landing/TestimonialsSection';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <LandingNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <DashboardPreviewSection />
        <BenefitsSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
