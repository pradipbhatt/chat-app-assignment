import { useState } from 'react';
import { TypingIndicator } from './TypingIndicator.jsx';

export function MessageComposer({ onSend, onTyping, typingUsers, disabled, disabledReason }) {
  const [text, setText] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    onSend(value);
  };

  const change = (event) => {
    setText(event.target.value);
    if (event.target.value.trim().length > 0) onTyping();
  };

  return (
    <div className="border-t border-border bg-surface px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <TypingIndicator users={typingUsers} />
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <input
            id="composer"
            value={text}
            onChange={change}
            disabled={disabled}
            maxLength={2000}
            autoComplete="off"
            placeholder={disabled ? disabledReason : 'Write a message'}
            className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || text.trim().length === 0}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
        {disabled && <p className="mt-2 text-xs text-warning">{disabledReason}</p>}
      </div>
    </div>
  );
}
