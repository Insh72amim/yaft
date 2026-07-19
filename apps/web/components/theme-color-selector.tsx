'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yaft-color-theme';
type ColorTheme = 'green' | 'blue' | 'yellow' | 'purple';

export function ThemeColorSelector() {
  const [activeColor, setActiveColor] = useState<ColorTheme>('green');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ColorTheme;
    if (saved) {
      setActiveColor(saved);
      document.documentElement.dataset.colorTheme = saved;
    }
  }, []);

  const changeColor = (color: ColorTheme) => {
    setActiveColor(color);
    document.documentElement.dataset.colorTheme = color;
    localStorage.setItem(STORAGE_KEY, color);
  };

  const themes: { name: ColorTheme; bg: string; label: string }[] = [
    { name: 'green', bg: '#174f3b', label: 'Green' },
    { name: 'blue', bg: '#1e40af', label: 'Blue' },
    { name: 'yellow', bg: '#b45309', label: 'Yellow' },
    { name: 'purple', bg: '#6d28d9', label: 'Purple' },
  ];

  return (
    <div className="color-theme-selector">
      <span>Theme Color</span>
      <div className="color-dots">
        {themes.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`color-dot ${activeColor === t.name ? 'active' : ''}`}
            style={{ backgroundColor: t.bg }}
            onClick={() => changeColor(t.name)}
            title={t.label}
            aria-label={`Switch to ${t.label} theme`}
          />
        ))}
      </div>
    </div>
  );
}
