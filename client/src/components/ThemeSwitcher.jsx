import { useTheme } from '../context/ThemeContext.jsx';

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className="inline-flex items-center gap-1 rounded-panel border border-border bg-surface p-1"
    >
      {themes.map((option) => {
        const active = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-elevated hover:text-fg'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
