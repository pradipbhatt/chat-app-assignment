import { useState } from 'react';

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {off && (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          d="M4 20 20 4"
        />
      )}
    </svg>
  );
}

export function TextField({ id, label, hint, error, type = 'text', ...props }) {
  const [revealed, setRevealed] = useState(false);
  const isSecret = type === 'password';
  const effectiveType = isSecret && revealed ? 'text' : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={effectiveType}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full rounded-clay bg-elevated py-2.5 pl-3.5 text-sm text-fg shadow-clay-in placeholder:text-fg-subtle disabled:opacity-70 ${
            isSecret ? 'pr-12' : 'pr-3.5'
          } ${error ? 'ring-2 ring-danger' : ''}`}
          {...props}
        />

        {isSecret && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={revealed}
            title={revealed ? 'Hide' : 'Show'}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-fg-muted shadow-clay-sm transition-transform hover:-translate-y-1/2 hover:scale-105 hover:text-fg"
          >
            <EyeIcon off={revealed} />
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
