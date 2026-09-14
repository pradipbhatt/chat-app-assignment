import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  THEMES,
  DEFAULT_THEME,
  TOKEN_KEYS,
  isValidTheme,
  readStoredTheme,
  persistTheme,
  clayVariables,
  customThemeId,
  isCustomThemeId,
} from '../lib/themes.js';
import { getThemes } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

const ThemeContext = createContext(null);

function applyCustom(theme) {
  const root = document.documentElement;
  root.dataset.theme = 'custom';

  for (const key of TOKEN_KEYS) {
    const value = theme.colors?.[key];
    if (value) root.style.setProperty(`--color-${key}`, value);
  }

  const clay = clayVariables(theme.mode, theme.shadowTint);
  for (const [name, value] of Object.entries(clay)) root.style.setProperty(name, value);
}

function clearCustom() {
  const root = document.documentElement;
  for (const key of TOKEN_KEYS) root.style.removeProperty(`--color-${key}`);
  for (const name of ['--clay-hi', '--clay-lo', '--clay-drop', '--clay-inner']) {
    root.style.removeProperty(name);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [customThemes, setCustomThemes] = useState([]);

  const refreshThemes = useCallback(async () => {
    try {
      const data = await getThemes();
      setCustomThemes(Array.isArray(data?.themes) ? data.themes : []);
    } catch (error) {
      setCustomThemes([]);
    }
  }, []);

  useEffect(() => {
    refreshThemes();
  }, [refreshThemes]);

  useEffect(() => {
    const socket = getSocket();
    const onUpdated = () => refreshThemes();
    socket.on('themes:updated', onUpdated);
    return () => socket.off('themes:updated', onUpdated);
  }, [refreshThemes]);

  useEffect(() => {
    if (isCustomThemeId(theme)) {
      const slug = theme.slice('custom:'.length);
      const match = customThemes.find((entry) => entry.slug === slug);
      if (match) {
        applyCustom(match);
        return;
      }
      if (customThemes.length === 0) return;
      clearCustom();
      document.documentElement.dataset.theme = DEFAULT_THEME;
      return;
    }

    clearCustom();
    document.documentElement.dataset.theme = theme;
  }, [theme, customThemes]);

  const setTheme = useCallback(
    (next) => {
      const valid = isValidTheme(next) || isCustomThemeId(next);
      if (!valid) return;
      setThemeState(next);
      persistTheme(next);
    },
    [],
  );

  const options = useMemo(
    () => [
      ...THEMES.map((entry) => ({ ...entry, custom: false })),
      ...customThemes.map((entry) => ({
        id: customThemeId(entry.slug),
        label: entry.name,
        hint: entry.mode === 'dark' ? 'Custom dark' : 'Custom light',
        swatches: [
          `rgb(${entry.colors.accent})`,
          `rgb(${entry.colors.success})`,
          `rgb(${entry.colors.bg})`,
        ],
        custom: true,
        source: entry,
      })),
    ],
    [customThemes],
  );

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: options,
      customThemes,
      refreshThemes,
      defaultTheme: DEFAULT_THEME,
    }),
    [theme, setTheme, options, customThemes, refreshThemes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider.');
  return context;
}
