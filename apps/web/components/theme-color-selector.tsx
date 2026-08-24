'use client';

import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yaft-color-theme';
type ColorTheme = 'green' | 'blue' | 'yellow' | 'purple';

const THEMES: { name: ColorTheme; bg: string; label: string }[] = [
  { name: 'green', bg: '#174f3b', label: 'Emerald' },
  { name: 'blue', bg: '#1e40af', label: 'Royal Blue' },
  { name: 'yellow', bg: '#b45309', label: 'Terracotta' },
  { name: 'purple', bg: '#6d28d9', label: 'Amethyst' },
];

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

  const currentTheme = THEMES.find((t) => t.name === activeColor) || THEMES[0];

  return (
    <div className="color-theme-selector">
      <div className="color-theme-header">
        <div className="color-theme-title">
          <Palette size={14} />
          <span>Theme &amp; Style</span>
        </div>
        <small className="color-theme-active-label">{currentTheme.label}</small>
      </div>
      <div className="color-dots">
        {THEMES.map((t) => (
          <button
            key={t.name}
            type="button"
            className={`color-dot ${activeColor === t.name ? 'active' : ''}`}
            style={{ backgroundColor: t.bg }}
            onClick={() => changeColor(t.name)}
            title={`Switch to ${t.label} theme`}
            aria-label={`Switch to ${t.label} theme`}
          />
        ))}
      </div>
    </div>
  );
}
