export function PendingMessage({ entry, onRetry, onDiscard }) {
  const failed = entry.status === 'failed';

  return (
    <li className="flex flex-row-reverse gap-2.5">
      <div className="w-8 shrink-0" />
      <div className="flex max-w-[78%] flex-col items-end gap-1">
        <div
          className={`rounded-bubble px-3.5 py-2 text-sm leading-relaxed ${
            failed ? 'border border-danger/50 bg-danger/10 text-fg' : 'bg-accent/50 text-accent-fg'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{entry.text}</p>
        </div>

        {failed ? (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] text-danger">{entry.reason || 'Not delivered'}</span>
            <button
              type="button"
              onClick={() => onRetry(entry.tempId)}
              className="text-[11px] font-medium text-accent hover:underline"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard(entry.tempId)}
              className="text-[11px] text-fg-subtle hover:text-fg"
            >
              Discard
            </button>
          </div>
        ) : (
          <span className="px-1 text-[11px] text-fg-subtle">Sending…</span>
        )}
      </div>
    </li>
  );
}
