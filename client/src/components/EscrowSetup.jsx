import { useState } from 'react';
import { TextField } from './TextField.jsx';
import { Notice } from './Notice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createEscrowKeypair, saveEscrowVault } from '../lib/escrowBridge.js';

export function EscrowSetup({ onDone }) {
  const { token } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tooShort = passphrase.length > 0 && passphrase.length < 12;
  const mismatch = confirmation.length > 0 && confirmation !== passphrase;
  const ready = passphrase.length >= 12 && confirmation === passphrase && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      const vault = await createEscrowKeypair(passphrase);
      await saveEscrowVault(vault, token);
      onDone();
    } catch (requestError) {
      setError(requestError.message || 'Could not set up the review key.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Notice tone="warning">
        This passphrase is the only way to read private rooms later. It is never sent to the
        server, so nobody — including this app — can recover it for you.
      </Notice>

      <TextField
        id="escrow-passphrase"
        label="Review passphrase"
        type="password"
        autoComplete="new-password"
        value={passphrase}
        hint="At least 12 characters. Different from your sign in password."
        error={tooShort ? 'Use at least 12 characters.' : null}
        onChange={(event) => setPassphrase(event.target.value)}
      />

      <TextField
        id="escrow-confirm"
        label="Type it again"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        error={mismatch ? 'These do not match.' : null}
        onChange={(event) => setConfirmation(event.target.value)}
      />

      {error && <Notice tone="danger">{error}</Notice>}

      <button
        type="button"
        onClick={submit}
        disabled={!ready}
        className="w-full rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent disabled:opacity-50"
      >
        {busy ? 'Generating…' : 'Create the review key'}
      </button>
    </div>
  );
}
