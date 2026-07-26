import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import './globals.css';

export const metadata = {
  title: 'YAFT',
  description: 'Yet Another Financial Tool — your private financial home',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

const themeScript = `
  (() => {
    try {
      const saved = localStorage.getItem('yaft-theme');
      const theme = saved === 'light' || saved === 'dark'
        ? saved
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;

      const savedColor = localStorage.getItem('yaft-color-theme');
      if (savedColor) document.documentElement.dataset.colorTheme = savedColor;
    } catch {
      document.documentElement.dataset.theme = 'light';
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>{children}</body></html>;
}
