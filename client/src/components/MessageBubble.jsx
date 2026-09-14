import { formatTime, initials, avatarTone } from '../lib/format.js';

const TONE_CLASS = {
  accent: 'bg-accent text-accent-fg',
  success: 'bg-success text-bg',
  warning: 'bg-warning text-bg',
  danger: 'bg-danger text-bg',
};

export function MessageBubble({ message, own, showAuthor }) {
  if (message.system) {
    return (
      <li className="my-2 flex justify-center">
        <span className="rounded-full bg-elevated px-3 py-1 text-xs text-fg-subtle">
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
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
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
        <div
          className={`rounded-bubble px-3.5 py-2 text-sm leading-relaxed ${
            own ? 'bg-accent text-accent-fg' : 'bg-elevated text-fg'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        </div>
        <span className="px-1 text-[11px] text-fg-subtle">{formatTime(message.ts)}</span>
      </div>
    </li>
  );
}
