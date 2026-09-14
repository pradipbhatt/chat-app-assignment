import { useMemo, useState } from 'react';
import { Notice } from './Notice.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  THEME_TOKENS,
  hexToTriple,
  tripleToHex,
  readCurrentTokens,
  customThemeId,
  checkContrast,
} from '../lib/themes.js';
import { createTheme, updateTheme, deleteTheme } from '../lib/api.js';

const GROUPS = ['Surfaces', 'Text', 'Accent', 'Status'];

export function ThemeEditor({ editing, onDone }) {
  const { refreshThemes, setTheme } = useTheme();
  const { token } = useAuth();

  const [name, setName] = useState(editing ? editing.name : 'My theme');
  const [mode, setMode] = useState(editing ? editing.mode : 'light');
  const [colors, setColors] = useState(() =>
    editing ? { ...editing.colors } : readCurrentTokens(),
  );
  const [shadowTint, setShadowTint] = useState(editing ? editing.shadowTint : '72 44 140');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(
    () => GROUPS.map((group) => ({ group, tokens: THEME_TOKENS.filter((t) => t.group === group) })),
    [],
  );

  const preview = {
    background: `rgb(${colors.bg})`,
    color: `rgb(${colors.fg})`,
  };

  const contrast = useMemo(() => checkContrast(colors), [colors]);
  const failing = contrast.filter((entry) => !entry.pass);

  const save = async () => {
    setBusy(true);
    setError(null);

    const payload = { name: name.trim(), mode, colors, shadowTint };

    try {
      const result = editing
        ? await updateTheme(editing.id, payload, token)
        : await createTheme(payload, token);
      await refreshThemes();
      setTheme(customThemeId(result.theme.slug));
      onDone();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteTheme(editing.id, token);
      await refreshThemes();
      onDone();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="theme-name" className="text-sm font-bold">
          Theme name
        </label>
        <input
          id="theme-name"
          value={name}
          maxLength={32}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-clay bg-elevated px-3.5 py-2.5 text-sm text-fg shadow-clay-in"
        />
      </div>

      <div role="radiogroup" aria-label="Theme mode" className="flex gap-2">
        {['light', 'dark'].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => setMode(option)}
            className={`flex-1 rounded-full px-3 py-2 font-display text-sm font-bold capitalize ${
              mode === option
                ? 'bg-accent text-accent-fg shadow-clay-accent'
                : 'bg-surface text-fg-muted shadow-clay-sm'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-fg-subtle">
        Mode decides how the clay highlights are lit, not the colours themselves.
      </p>

      {grouped.map(({ group, tokens }) => (
        <div key={group}>
          <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            {group}
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {tokens.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2.5 rounded-clay bg-elevated px-2.5 py-2 shadow-clay-in"
              >
                <input
                  type="color"
                  aria-label={item.label}
                  value={tripleToHex(colors[item.key])}
                  onChange={(event) =>
                    setColors((current) => ({
                      ...current,
                      [item.key]: hexToTriple(event.target.value),
                    }))
                  }
                  className="h-7 w-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
                <span className="truncate text-xs font-bold">{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <label className="flex items-center gap-2.5 rounded-clay bg-elevated px-2.5 py-2 shadow-clay-in">
        <input
          type="color"
          aria-label="Shadow tint"
          value={tripleToHex(shadowTint)}
          onChange={(event) => setShadowTint(hexToTriple(event.target.value))}
          className="h-7 w-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
        />
        <span className="text-xs font-bold">Shadow tint</span>
      </label>

      <div className="rounded-panel p-4 shadow-clay-in" style={preview}>
        <p className="font-display text-sm font-extrabold">Preview</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-bubble px-3.5 py-2 text-xs"
            style={{ background: `rgb(${colors.accent})`, color: `rgb(${colors['accent-fg']})` }}
          >
            Your message
          </span>
          <span
            className="rounded-bubble px-3.5 py-2 text-xs"
            style={{ background: `rgb(${colors.surface})`, color: `rgb(${colors.fg})` }}
          >
            Theirs
          </span>
          <span className="text-xs" style={{ color: `rgb(${colors['fg-muted']})` }}>
            muted
          </span>
          <span className="text-xs" style={{ color: `rgb(${colors.success})` }}>
            connected
          </span>
          <span className="text-xs" style={{ color: `rgb(${colors.danger})` }}>
            failed
          </span>
        </div>
      </div>

      {failing.length > 0 ? (
        <div className="rounded-clay bg-warning/12 px-3.5 py-3 text-sm text-warning shadow-clay-in">
          <p className="font-bold">
            {failing.length} combination{failing.length === 1 ? '' : 's'} may be hard to read
          </p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {failing.map((entry) => (
              <li key={entry.label} className="font-mono text-[11px]">
                {entry.label} · {entry.ratio.toFixed(1)}:1 (needs {entry.min}:1)
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs opacity-90">
            You can still save — everyone who picks this theme sees it as it is.
          </p>
        </div>
      ) : (
        <p className="font-mono text-[11px] text-success">
          All text combinations pass contrast.
        </p>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 rounded-full bg-elevated px-4 py-2.5 font-display text-sm font-bold text-fg-muted shadow-clay-in"
        >
          Cancel
        </button>
        {editing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-full bg-danger/15 px-4 py-2.5 font-display text-sm font-bold text-danger shadow-clay-in disabled:opacity-50"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={busy || name.trim().length < 2}
          className="flex-1 rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent disabled:opacity-50"
        >
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Save theme'}
        </button>
      </div>
    </div>
  );
}
