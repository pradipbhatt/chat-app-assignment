import { useEffect, useRef } from 'react';

export function SlideOver({ open, onClose, title, children }) {
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
    <div className="fixed inset-0 z-40 flex md:hidden">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="flex-1 bg-bg/70"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex w-72 max-w-[85vw] flex-col bg-surface shadow-clay"
      >
        <header className="flex items-center justify-between px-4 py-3.5">
          <h2 className="font-display text-base font-extrabold text-fg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-in hover:text-fg"
          >
            Close
          </button>
        </header>
        <div className="scrollbar-soft flex-1 overflow-y-auto px-4 py-5">{children}</div>
      </div>
    </div>
  );
}
