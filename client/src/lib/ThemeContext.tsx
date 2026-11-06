import * as React from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'ci-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'dark';
  });

  const applyTheme = React.useCallback((nextTheme: Theme) => {
    const root = document.documentElement;
    if (nextTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    }

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', nextTheme === 'light' ? '#F6F4EF' : '#0B0D10');
    }
  }, []);

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

const getFallbackTheme = (): Theme => {
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('light')) return 'light';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
  }
  return 'dark';
};

const fallbackThemeContext: ThemeContextType = {
  theme: 'dark',
  setTheme: (next) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (next === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      }
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage error
      }
    }
  },
  toggleTheme: () => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const isDark = !root.classList.contains('light');
      const next: Theme = isDark ? 'light' : 'dark';
      if (next === 'light') {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.remove('light');
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
      }
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore storage error
      }
    }
  },
};

export function useTheme(): ThemeContextType {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return {
      ...fallbackThemeContext,
      theme: getFallbackTheme(),
    };
  }
  return context;
}

