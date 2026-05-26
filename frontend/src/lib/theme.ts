export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'ims-theme';

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function initializeTheme() {
  applyTheme(getStoredTheme());
}

export function toggleTheme(currentTheme: ThemeMode): ThemeMode {
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme;
}
