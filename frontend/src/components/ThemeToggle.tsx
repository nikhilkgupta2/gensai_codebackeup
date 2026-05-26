import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { applyTheme, getStoredTheme, toggleTheme, type ThemeMode } from '../lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      onClick={() => setTheme((current) => toggleTheme(current))}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
