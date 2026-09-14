import { useEffect, useRef, useState } from 'react';
import { SERVER_URL } from '../lib/api.js';

const POLL_MS = 10000;
const HISTORY = 40;

const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export function StatusPage() {
  const [health, setHealth] = useState(null);
  const [state, setState] = useState('checking');
  const [samples, setSamples] = useState([]);
  const [latency, setLatency] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      const started = performance.now();
      try {
        const response = await fetch(`${SERVER_URL}/health`, { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;

        const took = Math.round(performance.now() - started);
        setHealth(data);
        setLatency(took);
        setState(data.database === 'connected' ? 'up' : 'degraded');
        setSamples((current) =>
          [...current, { ok: data.database === 'connected', took }].slice(-HISTORY),
        );
      } catch (error) {
        if (!active) return;
        setState('down');
        setHealth(null);
        setLatency(null);
        setSamples((current) => [...current, { ok: false, took: null }].slice(-HISTORY));
      }
      if (active) setCheckedAt(new Date());
    };

    poll();
    timer.current = setInterval(poll, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer.current);
    };
  }, []);

  const tone =
    state === 'up'
      ? { label: 'All systems normal', dot: 'bg-success', text: 'text-success' }
      : state === 'degraded'
        ? { label: 'Degraded', dot: 'bg-warning', text: 'text-warning' }
        : state === 'down'
          ? { label: 'Not responding', dot: 'bg-danger', text: 'text-danger' }
          : { label: 'Checking…', dot: 'bg-fg-subtle', text: 'text-fg-muted' };

  const reachable = samples.filter((sample) => sample.ok).length;
  const availability = samples.length ? Math.round((reachable / samples.length) * 100) : null;

  const tiles = [
    ['Uptime', formatUptime(health?.uptime)],
    ['Database', health?.database ?? '—'],
    ['People online', health?.connections ?? '—'],
    ['Active rooms', health?.rooms ?? '—'],
    ['Response', latency === null ? '—' : `${latency}ms`],
    ['Checks passing', availability === null ? '—' : `${availability}%`],
  ];

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col gap-5 px-5 py-10 sm:py-16">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">
          Service status
        </p>
        <h1 className="mt-1 font-display text-4xl font-extrabold">Chat Room</h1>
      </header>

      <section className="rounded-panel bg-surface p-6 shadow-clay">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-3 w-3 rounded-full ${tone.dot} ${
              state === 'checking' ? 'animate-pulse' : ''
            }`}
          />
          <p className={`font-display text-2xl font-extrabold ${tone.text}`}>{tone.label}</p>
        </div>

        <p className="mt-1.5 text-sm text-fg-muted">
          {state === 'down'
            ? 'The chat service is not answering. It may be waking from idle, which can take up to a minute.'
            : state === 'degraded'
              ? 'The service is answering but its database is not connected, so messages may not be stored.'
              : 'Messages are being delivered and stored normally.'}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-clay bg-elevated px-3 py-2.5 shadow-clay-in">
              <dt className="font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
                {label}
              </dt>
              <dd className="mt-0.5 truncate font-display text-lg font-bold text-fg">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-panel bg-surface p-6 shadow-clay">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            Checks from this page
          </h2>
          <span className="font-mono text-[11px] text-fg-subtle">every 10s</span>
        </div>

        <div className="mt-3 flex items-end gap-[3px]" aria-hidden="true">
          {Array.from({ length: HISTORY }).map((_, index) => {
            const sample = samples[samples.length - HISTORY + index];
            if (!sample) {
              return <span key={index} className="h-6 flex-1 rounded-sm bg-track" />;
            }
            return (
              <span
                key={index}
                className={`h-6 flex-1 rounded-sm ${sample.ok ? 'bg-success' : 'bg-danger'}`}
              />
            );
          })}
        </div>

        <p className="mt-3 text-xs text-fg-subtle">
          {samples.length === 0
            ? 'Waiting for the first check.'
            : `${reachable} of ${samples.length} checks answered since you opened this page. This is a live probe, not a stored history.`}
        </p>
      </section>

      <section className="rounded-panel bg-surface p-6 shadow-clay">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
          About this service
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-fg-muted">
          <li>
            The chat interface is served from a static host; this page reports the separate
            realtime server that carries messages.
          </li>
          <li>
            That server sleeps after a spell without traffic, so the first request after a quiet
            period can take up to a minute while it wakes.
          </li>
          <li>
            Conversation contents are not reported here. Only whether the service is answering and
            how many people are connected.
          </li>
        </ul>

        <a
          href="/"
          className="mt-5 inline-flex rounded-full bg-accent px-4 py-2.5 font-display text-sm font-bold text-accent-fg shadow-clay-accent"
        >
          Open the chat
        </a>
      </section>

      <footer className="pb-4 text-center font-mono text-[11px] text-fg-subtle">
        {checkedAt ? `Last checked ${checkedAt.toLocaleTimeString()}` : 'Not yet checked'}
      </footer>
    </main>
  );
}
