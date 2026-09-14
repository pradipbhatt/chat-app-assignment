import { useState } from 'react';
import { TypingIndicator } from './TypingIndicator.jsx';

export function MessageComposer({ onSend, onTyping, typingUsers, disabled, disabledReason }) {
  const [text, setText] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    onSend(value);
  };

  const change = (event) => {
    setText(event.target.value);
    if (event.target.value.trim().length > 0) onTyping();
  };

  return (
    <div className="bg-surface px-4 py-3 shadow-[0_-10px_24px_-18px_var(--clay-drop)] sm:px-6">
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
            maxLength={2000}
            autoComplete="off"
            placeholder={disabled ? 'Offline — messages will queue' : 'Write a message'}
            className="flex-1 rounded-full bg-elevated px-5 py-3 text-sm text-fg shadow-clay-in placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={text.trim().length === 0}
            className="rounded-full bg-accent px-5 py-3 font-display text-sm font-bold text-accent-fg shadow-clay-accent transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
        {disabled && (
          <p className="mt-2 text-xs text-warning">
            {disabledReason} They will send as soon as it returns.
          </p>
        )}
      </div>
    </div>
  );
}
