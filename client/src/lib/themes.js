export const THEME_STORAGE_KEY = 'chat-theme';

export const THEMES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'midnight', label: 'Midnight' },
];

export const DEFAULT_THEME = 'dark';

export function isValidTheme(value) {
  return THEMES.some((theme) => theme.id === value);
}

export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isValidTheme(stored) ? stored : DEFAULT_THEME;
  } catch (error) {
    return DEFAULT_THEME;
  }
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    return;
  }
}
