'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';

const STORAGE_KEY = 'yaft-theme';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) applyTheme(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', followSystem);
    return () => media.removeEventListener('change', followSystem);
  }, []);

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return <button className={`theme-toggle ${className}`.trim()} type="button" onClick={toggleTheme} aria-label="Toggle color theme" title="Toggle color theme">
    <Sun className="theme-icon theme-icon-light" aria-hidden="true" />
    <Moon className="theme-icon theme-icon-dark" aria-hidden="true" />
    <span className="theme-label" aria-hidden="true" />
  </button>;
}
