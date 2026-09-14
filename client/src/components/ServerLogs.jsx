import { useEffect, useRef } from 'react';
import { useServerLogs } from '../hooks/useServerLogs.js';

const LEVEL_CLASS = {
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-fg-muted',
};

const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

const clock = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function ServerLogs({ open }) {
  const { entries, status, state, paused, setPaused, clear } = useServerLogs(open);
  const endRef = useRef(null);

  useEffect(() => {
    if (!paused) endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries, paused]);

  if (!open) return null;

  const stats = [
    ['uptime', formatUptime(status?.uptime)],
    ['online', status?.connections ?? '—'],
    ['rooms', status?.rooms ?? '—'],
    ['private', status?.privateRooms ?? '—'],
    ['memory', status ? `${status.memoryMb}mb` : '—'],
    ['node', status?.node ?? '—'],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">Server</h3>
        <span
          className={`flex items-center gap-1.5 text-[11px] font-bold ${
            status?.database === 'connected' ? 'text-success' : 'text-danger'
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status?.database === 'connected' ? 'bg-success' : 'bg-danger'
            }`}
          />
          {status?.database ?? 'unknown'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-clay bg-elevated px-3 py-2.5 shadow-clay-in">
            <dt className="font-mono text-[9px] uppercase tracking-wide text-fg-subtle">{label}</dt>
            <dd className="mt-0.5 truncate font-mono text-xs font-medium text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          className={`flex-1 rounded-full px-2 py-1.5 text-[11px] font-bold shadow-clay-in ${
            paused ? 'bg-warning/15 text-warning' : 'bg-elevated text-fg-muted'
          }`}
        >
          {paused ? 'Paused' : 'Live'}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-full bg-elevated px-3 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-in hover:text-fg"
        >
          Clear view
        </button>
      </div>

      <div className="scrollbar-soft max-h-64 overflow-y-auto rounded-clay bg-bg p-3.5 shadow-clay-in">
        {state === 'loading' && <p className="text-[11px] text-fg-subtle">Connecting to the log…</p>}
        {state === 'error' && (
          <p className="text-[11px] text-danger">Could not read the log stream.</p>
        )}
        {state === 'ready' && entries.length === 0 && (
          <p className="text-[11px] text-fg-subtle">Nothing logged yet.</p>
        )}

        <ul className="flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-2.5 font-mono text-[10.5px] leading-relaxed">
              <span className="shrink-0 text-fg-subtle">{clock(entry.ts)}</span>
              <span className={`break-all ${LEVEL_CLASS[entry.level] ?? 'text-fg-muted'}`}>
                {entry.message}
              </span>
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </div>
    </div>
  );
}
