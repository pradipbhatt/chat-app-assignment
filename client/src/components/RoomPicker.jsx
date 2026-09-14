import { useMemo, useState } from 'react';

const SUGGESTED = ['general', 'research', 'lab-meeting'];
const COLLAPSED = 6;

function timeAgo(ts) {
  if (!ts) return 'no messages yet';

  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function RoomRow({ entry, selected, onSelect }) {
  const busy = entry.users > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(entry.room)}
        aria-pressed={selected}
        className={`flex w-full items-center gap-3 rounded-clay px-3.5 py-2.5 text-left transition-transform ${
          selected
            ? 'bg-accent text-accent-fg shadow-clay-accent'
            : 'bg-surface text-fg shadow-clay-sm hover:-translate-y-0.5'
        }`}
      >
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            busy ? 'bg-success' : selected ? 'bg-accent-fg/40' : 'bg-fg-subtle/40'
          }`}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-tight">{entry.room}</span>
          <span
            className={`block truncate text-[11px] leading-tight ${
              selected ? 'text-accent-fg/75' : 'text-fg-subtle'
            }`}
          >
            {busy
              ? `${entry.users} here now`
              : `${entry.messages || 0} message${entry.messages === 1 ? '' : 's'} · ${timeAgo(entry.lastMessageAt)}`}
          </span>
        </span>

        {busy && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              selected ? 'bg-accent-fg/20 text-accent-fg' : 'bg-success/15 text-success'
            }`}
          >
            live
          </span>
        )}
      </button>
    </li>
  );
}

export function RoomPicker({ rooms, status, value, onSelect }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const entries = useMemo(() => {
    const known = new Set(rooms.map((entry) => entry.room));
    const suggestions = SUGGESTED.filter((name) => !known.has(name)).map((room) => ({
      room,
      users: 0,
      messages: 0,
      lastMessageAt: null,
    }));

    return [...rooms, ...suggestions].sort((a, b) => {
      if (b.users !== a.users) return b.users - a.users;
      return (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
    });
  }, [rooms]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? entries.filter((entry) => entry.room.includes(needle)) : entries;
  }, [entries, query]);

  if (status === 'error') {
    return (
      <p className="rounded-clay bg-elevated px-3.5 py-2.5 text-xs text-fg-muted shadow-clay-in">
        Room list unavailable. Type a room name below.
      </p>
    );
  }

  if (status === 'loading') {
    return (
      <ul className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <li key={row} className="h-[52px] animate-pulse rounded-clay bg-elevated shadow-clay-in" />
        ))}
      </ul>
    );
  }

  const live = filtered.filter((entry) => entry.users > 0);
  const quiet = filtered.filter((entry) => entry.users === 0);
  const shown = expanded || query ? quiet : quiet.slice(0, Math.max(0, COLLAPSED - live.length));
  const hidden = quiet.length - shown.length;

  return (
    <div className="flex flex-col gap-2.5">
      {entries.length > COLLAPSED && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search rooms"
          aria-label="Search rooms"
          className="w-full rounded-clay bg-elevated px-3.5 py-2 text-sm text-fg shadow-clay-in placeholder:text-fg-subtle"
        />
      )}

      {live.length > 0 && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            People here now
          </p>
          <ul className="flex flex-col gap-2">
            {live.map((entry) => (
              <RoomRow
                key={entry.room}
                entry={entry}
                selected={entry.room === value}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}

      {shown.length > 0 && (
        <>
          {live.length > 0 && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
              Quiet rooms
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {shown.map((entry) => (
              <RoomRow
                key={entry.room}
                entry={entry}
                selected={entry.room === value}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </>
      )}

      {filtered.length === 0 && (
        <p className="rounded-clay bg-elevated px-3.5 py-3 text-xs text-fg-muted shadow-clay-in">
          No room matches “{query}”. Type it below to start it.
        </p>
      )}

      {hidden > 0 && !query && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="self-start rounded-full bg-elevated px-3.5 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-in hover:text-fg"
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more room${hidden === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}
