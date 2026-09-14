export const THEME_STORAGE_KEY = 'chat-theme';

export const THEMES = [
  {
    id: 'playground',
    label: 'Playground',
    hint: 'Soft lilac daylight',
    swatches: ['rgb(108 75 232)', 'rgb(14 158 119)', 'rgb(239 234 251)'],
  },
  {
    id: 'bubblegum',
    label: 'Bubblegum',
    hint: 'Warm pink daylight',
    swatches: ['rgb(198 42 138)', 'rgb(212 91 18)', 'rgb(255 239 244)'],
  },
  {
    id: 'nightlab',
    label: 'Night Lab',
    hint: 'Deep violet dark',
    swatches: ['rgb(138 112 232)', 'rgb(42 163 129)', 'rgb(25 19 51)'],
  },
];

export const DEFAULT_THEME = 'playground';

const LEGACY = { dark: 'nightlab', midnight: 'nightlab', light: 'playground' };

export function isValidTheme(value) {
  return THEMES.some((theme) => theme.id === value);
}

export function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const resolved = LEGACY[stored] || stored;
    return isValidTheme(resolved) ? resolved : DEFAULT_THEME;
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
