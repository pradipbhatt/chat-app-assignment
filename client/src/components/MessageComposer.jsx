import { useState } from 'react';

export function MessageComposer({ onSend, disabled, disabledReason }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || disabled || sending) return;

    setSending(true);
    const response = await onSend(value);
    setSending(false);

    if (response?.ok) setText('');
  };

  return (
    <div className="border-t border-border bg-surface px-4 py-3 sm:px-6">
      <form onSubmit={submit} className="mx-auto flex max-w-2xl items-end gap-2">
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <input
          id="composer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={disabled}
          maxLength={2000}
          autoComplete="off"
          placeholder={disabled ? disabledReason : 'Write a message'}
          className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || sending || text.trim().length === 0}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
      {disabled && <p className="mx-auto mt-2 max-w-2xl text-xs text-warning">{disabledReason}</p>}
    </div>
  );
}
