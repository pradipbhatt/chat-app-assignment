import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEMES, DEFAULT_THEME, isValidTheme, readStoredTheme, persistTheme } from '../lib/themes.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (!isValidTheme(next)) return;
    setThemeState(next);
    persistTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, themes: THEMES, defaultTheme: DEFAULT_THEME }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}
