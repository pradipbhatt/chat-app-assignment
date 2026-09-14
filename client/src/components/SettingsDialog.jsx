import { useEffect, useRef } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';

export function SettingsDialog({ open, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
        className="relative w-full max-w-sm rounded-panel bg-surface p-6 shadow-clay"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="settings-title" className="font-display text-xl font-extrabold">
              Settings
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">Saved in this browser only.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-in hover:text-fg"
          >
            Done
          </button>
        </div>

        <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
          Theme
        </h3>
        <div className="mt-3">
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  );
}
