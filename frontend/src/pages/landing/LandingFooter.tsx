import { Github, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

import { LandingContainer } from '../../components/landing/LandingContainer';

const columns = [
  {
    title: 'Product',
    links: ['Inventory', 'Purchase orders', 'Suppliers', 'Analytics'],
  },
  {
    title: 'Company',
    links: ['About', 'Customers', 'Careers', 'Contact'],
  },
  {
    title: 'Resources',
    links: ['Docs', 'API reference', 'Security', 'Status'],
  },
];

export function LandingFooter() {
  return (
    <footer id="contact" className="border-t border-slate-200 bg-slate-50">
      <LandingContainer className="py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link to="/" className="text-lg font-semibold text-slate-950">
              IMS Inventory Cloud
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">
              Multi-tenant inventory management for retailers, warehouse managers, and platform teams.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://github.com"
                className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:text-slate-950"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="mailto:hello@ims.local"
                className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:text-slate-950"
                aria-label="Email IMS"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h3 className="text-sm font-semibold text-slate-950">{column.title}</h3>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a href="#platform" className="text-sm text-slate-600 transition hover:text-slate-950">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>© 2026 IMS Inventory Cloud. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="#contact" className="hover:text-slate-950">
              Privacy
            </a>
            <a href="#contact" className="hover:text-slate-950">
              Terms
            </a>
            <a href="#contact" className="hover:text-slate-950">
              Compliance
            </a>
          </div>
        </div>
      </LandingContainer>
    </footer>
  );
}
