const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        elevated: token('elevated'),
        fg: token('fg'),
        'fg-muted': token('fg-muted'),
        'fg-subtle': token('fg-subtle'),
        border: token('border'),
        accent: token('accent'),
        'accent-fg': token('accent-fg'),
        'accent-hover': token('accent-hover'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        track: token('track'),
      },
      borderRadius: {
        bubble: '1.35rem',
        panel: '1.75rem',
        clay: '1.25rem',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['Karla', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        clay: 'inset 0 -9px 14px var(--clay-lo), inset 0 9px 12px var(--clay-hi), 0 18px 34px -14px var(--clay-drop)',
        'clay-sm': 'inset 0 -5px 9px var(--clay-lo), inset 0 5px 8px var(--clay-hi), 0 10px 18px -10px var(--clay-drop)',
        'clay-in': 'inset 0 3px 7px var(--clay-inner), inset 0 -2px 4px var(--clay-hi)',
        swatch: 'inset 0 -2px 3px rgba(0, 0, 0, 0.25), inset 0 2px 3px rgba(255, 255, 255, 0.45)',
        'clay-accent':
          'inset 0 -6px 10px rgba(0, 0, 0, 0.22), inset 0 6px 9px rgba(255, 255, 255, 0.28), 0 14px 24px -10px var(--clay-drop)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
      },
    },
  },
  plugins: [],
};
