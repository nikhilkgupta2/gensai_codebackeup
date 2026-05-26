import { ArrowRight, Quote } from 'lucide-react';

import { LandingButton } from '../../components/landing/LandingButton';
import { LandingContainer } from '../../components/landing/LandingContainer';

export function TestimonialsSection() {
  return (
    <section id="customers" className="bg-white py-20">
      <LandingContainer>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-6 shadow-sm md:p-10">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                Customer story
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                From disconnected stock updates to controlled multi-warehouse operations.
              </h2>
              <p className="mt-5 leading-7 text-slate-600">
                A regional retailer used IMS to standardize receiving, separate access by location, and
                give leadership a reliable view of inventory health without exposing private tenant operations.
              </p>
              <LandingButton to="/register" variant="secondary" className="mt-7">
                Explore the workflow
                <ArrowRight className="h-4 w-4" />
              </LandingButton>
            </div>
            <figure className="rounded-md bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
              <Quote className="h-8 w-8 text-blue-600" />
              <blockquote className="mt-6 text-xl font-medium leading-9 text-slate-950">
                “IMS gave our operations team a single source of truth. Store managers can move quickly,
                finance can trust receiving data, and our admins no longer need to manually reconcile
                every stock correction.”
              </blockquote>
              <figcaption className="mt-8 border-t border-slate-200 pt-5">
                <p className="font-semibold text-slate-950">Meera Shah</p>
                <p className="mt-1 text-sm text-slate-500">Director of Retail Operations, Northstar Goods</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </LandingContainer>
    </section>
  );
}
