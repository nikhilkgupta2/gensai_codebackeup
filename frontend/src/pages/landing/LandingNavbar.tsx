import { BarChart3, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ThemeToggle } from '../../components/ThemeToggle';
import { LandingButton } from '../../components/landing/LandingButton';
import { LandingContainer } from '../../components/landing/LandingContainer';
import { cn } from '../../lib/cn';

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Features', href: '#features' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Customers', href: '#customers' },
  { label: 'Contact', href: '#contact' },
];

export function LandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <LandingContainer className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3" aria-label="IMS home">
          <span className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-950 text-white shadow-sm">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold text-slate-950">IMS</span>
            <span className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Inventory Cloud
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <LandingButton
            to="/login"
            variant="secondary"
            className="h-11 border-slate-950 text-slate-950 hover:border-slate-950 dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:border-white/60 dark:hover:bg-white/5"
          >
            Login
          </LandingButton>
          <LandingButton
            to="/register"
            variant="primary"
            className="dark:border dark:border-white/40 dark:bg-[#ffffff] dark:text-black dark:hover:bg-[#b5b5b5]"
          >
            Start free
          </LandingButton>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="inline-grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-700"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </LandingContainer>

      <div className={cn('border-t border-slate-200 bg-white lg:hidden', !isOpen && 'hidden')}>
        <LandingContainer className="space-y-4 py-4">
          <nav className="grid gap-1" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="grid grid-cols-2 gap-3">
            <LandingButton
              to="/login"
              variant="secondary"
              className="border-slate-950 text-slate-950 hover:border-slate-950 dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:border-white/60 dark:hover:bg-white/5"
            >
              Login
            </LandingButton>
            <LandingButton
              to="/register"
              variant="primary"
              className="dark:border dark:border-white/40 dark:bg-[#a8a8a8] dark:text-black dark:hover:bg-[#b5b5b5]"
            >
              Start free
            </LandingButton>
          </div>
        </LandingContainer>
      </div>
    </header>
  );
}
