import { useEffect, useRef, useState } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';
import { ThemeEditor } from './ThemeEditor.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { isCustomThemeId } from '../lib/themes.js';

export function SettingsDialog({ open, onClose }) {
  const panelRef = useRef(null);
  const { isAdmin } = useAuth();
  const { theme, customThemes } = useTheme();
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  if (!open) return null;

  const selectedCustom = isCustomThemeId(theme)
    ? customThemes.find((entry) => `custom:${entry.slug}` === theme)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-bg/80"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="scrollbar-soft relative max-h-[86vh] w-full max-w-sm overflow-y-auto rounded-panel bg-surface p-6 shadow-clay"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="settings-title" className="font-display text-xl font-extrabold">
              {editing === null ? 'Settings' : editing ? 'Edit theme' : 'New theme'}
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              {editing === null
                ? 'Your choice is saved in this browser.'
                : 'Saved themes are available to everyone.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-in hover:text-fg"
          >
            Done
          </button>
        </div>

        {editing === null ? (
          <>
            <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
              Theme
            </h3>
            <div className="mt-3">
              <ThemeSwitcher />
            </div>

            {isAdmin && (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="w-full rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent"
                >
                  Create a theme
                </button>
                {selectedCustom && (
                  <button
                    type="button"
                    onClick={() => setEditing(selectedCustom)}
                    className="w-full rounded-full bg-surface px-4 py-2.5 font-display text-sm font-bold text-fg-muted shadow-clay-sm hover:text-fg"
                  >
                    Edit “{selectedCustom.name}”
                  </button>
                )}
                <p className="text-xs text-fg-subtle">
                  You are signed in as an administrator, so themes you save appear for every
                  person who opens the app.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5">
            <ThemeEditor editing={editing || null} onDone={() => setEditing(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
