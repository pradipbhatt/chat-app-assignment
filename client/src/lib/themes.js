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

export const THEME_TOKENS = [
  { key: 'bg', label: 'Page', group: 'Surfaces' },
  { key: 'surface', label: 'Cards', group: 'Surfaces' },
  { key: 'elevated', label: 'Inputs', group: 'Surfaces' },
  { key: 'border', label: 'Edges', group: 'Surfaces' },
  { key: 'track', label: 'Tracks', group: 'Surfaces' },
  { key: 'fg', label: 'Text', group: 'Text' },
  { key: 'fg-muted', label: 'Muted', group: 'Text' },
  { key: 'fg-subtle', label: 'Subtle', group: 'Text' },
  { key: 'accent', label: 'Accent', group: 'Accent' },
  { key: 'accent-fg', label: 'On accent', group: 'Accent' },
  { key: 'accent-hover', label: 'Accent hover', group: 'Accent' },
  { key: 'success', label: 'Success', group: 'Status' },
  { key: 'warning', label: 'Warning', group: 'Status' },
  { key: 'danger', label: 'Danger', group: 'Status' },
];

export const TOKEN_KEYS = THEME_TOKENS.map((token) => token.key);

export function hexToTriple(hex) {
  const clean = String(hex || '').replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const value = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(value)) return '0 0 0';
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

export function tripleToHex(triple) {
  const parts = String(triple || '')
    .trim()
    .split(/\s+/)
    .map((part) => Math.min(255, Math.max(0, Number(part) || 0)));
  if (parts.length !== 3) return '#000000';
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

export function clayVariables(mode, shadowTint) {
  const tint = String(shadowTint || '0 0 0');
  if (mode === 'dark') {
    return {
      '--clay-hi': 'rgba(255, 255, 255, 0.14)',
      '--clay-lo': 'rgba(0, 0, 0, 0.45)',
      '--clay-drop': 'rgba(0, 0, 0, 0.5)',
      '--clay-inner': 'rgba(0, 0, 0, 0.35)',
    };
  }
  return {
    '--clay-hi': 'rgba(255, 255, 255, 0.9)',
    '--clay-lo': `rgba(${tint.split(/\s+/).join(', ')}, 0.16)`,
    '--clay-drop': `rgba(${tint.split(/\s+/).join(', ')}, 0.26)`,
    '--clay-inner': `rgba(${tint.split(/\s+/).join(', ')}, 0.1)`,
  };
}

export function readCurrentTokens() {
  const styles = getComputedStyle(document.documentElement);
  const colors = {};
  for (const key of TOKEN_KEYS) {
    colors[key] = styles.getPropertyValue(`--color-${key}`).trim() || '0 0 0';
  }
  return colors;
}

export const customThemeId = (slug) => `custom:${slug}`;
export const isCustomThemeId = (value) => String(value || '').startsWith('custom:');

function channelLuminance(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(triple) {
  const [r, g, b] = String(triple || '0 0 0')
    .trim()
    .split(/\s+/)
    .map((part) => Number(part) || 0);
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

export const CONTRAST_PAIRS = [
  { fg: 'fg', bg: 'bg', label: 'Text on the page', min: 4.5 },
  { fg: 'fg', bg: 'surface', label: 'Text on cards', min: 4.5 },
  { fg: 'fg-muted', bg: 'surface', label: 'Muted text on cards', min: 4.5 },
  { fg: 'fg-muted', bg: 'elevated', label: 'Muted text on inputs', min: 4.5 },
  { fg: 'accent-fg', bg: 'accent', label: 'Text on the accent', min: 4.5 },
  { fg: 'fg-subtle', bg: 'surface', label: 'Subtle text on cards', min: 3 },
  { fg: 'danger', bg: 'surface', label: 'Error text on cards', min: 3 },
  { fg: 'success', bg: 'surface', label: 'Connected text on cards', min: 3 },
];

export function checkContrast(colors) {
  return CONTRAST_PAIRS.map((pair) => {
    const ratio = contrastRatio(colors[pair.fg], colors[pair.bg]);
    return { ...pair, ratio, pass: ratio >= pair.min };
  });
}
