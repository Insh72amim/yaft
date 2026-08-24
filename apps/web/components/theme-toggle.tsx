'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'yaft-theme';
const COLOR_STORAGE_KEY = 'yaft-color-theme';

type ThemeMode = 'light' | 'dark';
type ColorTheme = 'green' | 'blue' | 'yellow' | 'purple';

const THEMES: { name: ColorTheme; bg: string; label: string }[] = [
  { name: 'green', bg: '#174f3b', label: 'Emerald' },
  { name: 'blue', bg: '#1e40af', label: 'Royal Blue' },
  { name: 'yellow', bg: '#b45309', label: 'Terracotta' },
  { name: 'purple', bg: '#6d28d9', label: 'Amethyst' },
];

function applyThemeMode(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className = '', showColors = true }: { className?: string; showColors?: boolean }) {
  const [activeColor, setActiveColor] = useState<ColorTheme>('green');

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) applyThemeMode(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', followSystem);

    const savedColor = localStorage.getItem(COLOR_STORAGE_KEY) as ColorTheme;
    if (savedColor) {
      setActiveColor(savedColor);
      document.documentElement.dataset.colorTheme = savedColor;
    }

    return () => media.removeEventListener('change', followSystem);
  }, []);

  function toggleMode() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyThemeMode(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function changeColor(color: ColorTheme) {
    setActiveColor(color);
    document.documentElement.dataset.colorTheme = color;
    localStorage.setItem(COLOR_STORAGE_KEY, color);
  }

  if (className.includes('auth-theme-toggle') || !showColors) {
    return (
      <button
        className={`theme-toggle ${className}`.trim()}
        type="button"
        onClick={toggleMode}
        aria-label="Toggle dark/light mode"
        title="Toggle dark/light mode"
      >
        <Sun className="theme-icon theme-icon-light" aria-hidden="true" />
        <Moon className="theme-icon theme-icon-dark" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="sidebar-appearance">
      <button
        className="sidebar-theme-toggle"
        type="button"
        onClick={toggleMode}
        aria-label="Toggle dark/light mode"
        title="Toggle dark/light mode"
      >
        <Sun className="theme-icon theme-icon-light" size={16} aria-hidden="true" />
        <Moon className="theme-icon theme-icon-dark" size={16} aria-hidden="true" />
      </button>

      <div className="sidebar-color-dots">
        {THEMES.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`sidebar-color-dot ${activeColor === t.name ? 'active' : ''}`}
            onClick={() => changeColor(t.name)}
            title={`${t.label} accent`}
            aria-label={`Switch to ${t.label} accent`}
          >
            <span style={{ backgroundColor: t.bg }} />
          </button>
        ))}
      </div>
    </div>
  );
}
