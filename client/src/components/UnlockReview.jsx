import { useState } from 'react';
import { TextField } from './TextField.jsx';
import { Notice } from './Notice.jsx';
import { useReviewKey } from '../context/ReviewKeyContext.jsx';

export function UnlockReview({ compact = false }) {
  const { unlock } = useReviewKey();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await unlock(passphrase);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }

    setPassphrase('');
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!compact && (
        <p className="text-xs text-fg-muted">
          Enter the review passphrase to read encrypted rooms. It never leaves this browser.
        </p>
      )}

      <TextField
        id={compact ? 'inline-review-passphrase' : 'review-passphrase'}
        label="Review passphrase"
        type="password"
        autoComplete="off"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
      />

      {error && <Notice tone="danger">{error}</Notice>}

      <button
        type="submit"
        disabled={busy || passphrase.length < 8}
        className="w-full rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent disabled:opacity-50"
      >
        {busy ? 'Opening…' : 'Unlock encrypted rooms'}
      </button>
    </form>
  );
}
