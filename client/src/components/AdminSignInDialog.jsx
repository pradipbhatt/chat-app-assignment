import { useState } from 'react';
import { TextField } from './TextField.jsx';
import { Notice } from './Notice.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function AdminSignInDialog({ open, onClose }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(username.trim(), password);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setUsername('');
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-signin-title"
        className="w-full max-w-sm rounded-panel bg-surface p-6 shadow-clay"
      >
        <h2 id="admin-signin-title" className="font-display text-xl font-extrabold text-fg">
          Administrator sign in
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Moderation tools require an account. Regular chat needs no sign in.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <TextField
            id="admin-username"
            label="Account name"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            id="admin-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <Notice tone="danger">{error}</Notice>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-elevated px-4 py-2.5 font-display text-sm font-bold text-fg-muted shadow-clay-in hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="flex-1 rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
