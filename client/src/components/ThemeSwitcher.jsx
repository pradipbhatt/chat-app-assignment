import { useTheme } from '../context/ThemeContext.jsx';

export function ThemeSwitcher() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex flex-col gap-2">
      {themes.map((option) => {
        const active = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.id)}
            className={`flex items-center gap-3 rounded-clay px-3 py-2.5 text-left transition-transform ${
              active
                ? 'bg-accent text-accent-fg shadow-clay-accent'
                : 'bg-surface text-fg shadow-clay-sm hover:-translate-y-0.5'
            }`}
          >
            <span className="flex shrink-0 -space-x-1.5">
              {option.swatches.map((colour) => (
                <span
                  key={colour}
                  style={{ background: colour }}
                  className="h-5 w-5 rounded-full shadow-swatch"
                />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-bold leading-tight">
                {option.label}
              </span>
              <span
                className={`block text-xs leading-tight ${
                  active ? 'text-accent-fg/75' : 'text-fg-muted'
                }`}
              >
                {option.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
