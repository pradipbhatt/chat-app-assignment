import { useEffect, useState } from 'react';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { getHealth, SERVER_URL } from './lib/api.js';

export default function App() {
  const [health, setHealth] = useState({ state: 'loading' });

  useEffect(() => {
    let active = true;

    getHealth()
      .then((data) => active && setHealth({ state: 'ok', data }))
      .catch((error) => active && setHealth({ state: 'error', message: error.message }));

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Chat Room</h1>
          <p className="text-sm text-fg-muted">Foundation sprint — theme layer and server link</p>
        </div>
        <ThemeSwitcher />
      </header>

      <section className="rounded-panel border border-border bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-fg-subtle">Server</h2>
        <p className="mt-1 font-mono text-sm text-fg-muted">{SERVER_URL}</p>

        {health.state === 'loading' && <p className="mt-4 text-sm text-fg-muted">Checking…</p>}

        {health.state === 'error' && (
          <p className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {health.message}
          </p>
        )}

        {health.state === 'ok' && (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Status', health.data.status],
              ['Database', health.data.database],
              ['Rooms', health.data.rooms],
              ['Online', health.data.connections],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-elevated px-3 py-2">
                <dt className="text-xs uppercase tracking-wide text-fg-subtle">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-fg">{String(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="rounded-panel border border-border bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-fg-subtle">Token check</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg">accent</span>
          <span className="rounded-md bg-accent/50 px-3 py-1.5 text-sm text-fg">accent/50</span>
          <span className="rounded-md bg-elevated px-3 py-1.5 text-sm text-fg-muted">elevated</span>
          <span className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-subtle">
            border
          </span>
          <span className="rounded-md bg-success/15 px-3 py-1.5 text-sm text-success">success</span>
          <span className="rounded-md bg-warning/15 px-3 py-1.5 text-sm text-warning">warning</span>
          <span className="rounded-md bg-danger/15 px-3 py-1.5 text-sm text-danger">danger</span>
        </div>
      </section>
    </main>
  );
}
