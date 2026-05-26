import { ArrowRight } from 'lucide-react';

import { LandingButton } from '../../components/landing/LandingButton';
import { LandingContainer } from '../../components/landing/LandingContainer';

export function CtaSection() {
  return (
    <section className="bg-white pb-20">
      <LandingContainer>
        <div className="rounded-md bg-slate-950 px-6 py-12 text-center text-white shadow-xl shadow-slate-200 md:px-10 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Ready to operate clearly?</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
            Bring every stock movement, supplier order, and tenant workflow into one governed platform.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Start with a secure workspace for your team and grow into multi-tenant inventory operations when you need it.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <LandingButton to="/register" variant="primary" className="bg-white text-slate-950 hover:bg-slate-100">
              Create workspace
              <ArrowRight className="h-4 w-4" />
            </LandingButton>
            <LandingButton
              to="/login"
              variant="secondary"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              Sign in
            </LandingButton>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
