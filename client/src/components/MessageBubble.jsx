import { formatTime, initials, avatarTone } from '../lib/format.js';

const TONE_CLASS = {
  accent: 'bg-accent text-accent-fg',
  success: 'bg-success text-bg',
  warning: 'bg-warning text-bg',
  danger: 'bg-danger text-bg',
};

export function MessageBubble({ message, own, showAuthor, canModerate, onDelete }) {
  if (message.system) {
    return (
      <li className="flex justify-center py-1">
        <span className="rounded-full bg-elevated px-3.5 py-1.5 text-xs text-fg-subtle shadow-clay-in">
          {message.text}
        </span>
      </li>
    );
  }

  return (
    <li className={`flex animate-fade-in gap-2.5 ${own ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className="w-8 shrink-0">
        {showAuthor && !own && (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold shadow-clay-sm ${
              TONE_CLASS[avatarTone(message.username)]
            }`}
          >
            {initials(message.username)}
          </span>
        )}
      </div>

      <div className={`flex max-w-[78%] flex-col gap-1 ${own ? 'items-end' : 'items-start'}`}>
        {showAuthor && !own && (
          <span className="px-1 text-xs font-medium text-fg-muted">{message.username}</span>
        )}
        <div className="group/bubble flex items-center gap-1.5">
          {canModerate && own && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label={`Delete message from ${message.username}`}
              className="rounded px-1.5 py-0.5 text-[11px] text-fg-subtle opacity-0 transition-opacity hover:text-danger group-hover/bubble:opacity-100"
            >
              Delete
            </button>
          )}
          <div
            className={`rounded-bubble px-4 py-2.5 text-sm leading-relaxed ${
              message.locked
                ? 'bg-elevated text-fg-subtle shadow-clay-in'
                : own
                  ? 'bg-accent text-accent-fg shadow-clay-accent'
                  : 'bg-surface text-fg shadow-clay-sm'
            }`}
          >
            {message.locked ? (
              <p className="flex items-center gap-1.5 italic">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5">
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
                  />
                </svg>
                Encrypted — you do not have the key
              </p>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            )}
          </div>
          {canModerate && !own && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label={`Delete message from ${message.username}`}
              className="rounded px-1.5 py-0.5 text-[11px] text-fg-subtle opacity-0 transition-opacity hover:text-danger group-hover/bubble:opacity-100"
            >
              Delete
            </button>
          )}
        </div>
        <span className="px-1 text-[11px] text-fg-subtle">{formatTime(message.ts)}</span>
      </div>
    </li>
  );
}
