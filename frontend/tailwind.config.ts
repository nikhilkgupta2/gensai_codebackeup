import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(214 32% 91%)',
        surface: 'hsl(0 0% 100%)',
        muted: 'hsl(210 40% 98%)',
        ink: 'hsl(222 47% 11%)',
        subdued: 'hsl(215 16% 47%)',
      },
      borderRadius: {
        enterprise: '0.5rem',
      },
      boxShadow: {
        enterprise: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
} satisfies Config;
