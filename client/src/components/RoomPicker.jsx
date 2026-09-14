const SUGGESTED = ['research', 'general', 'lab-meeting'];

export function RoomPicker({ rooms, status, value, onSelect }) {
  const active = rooms.filter((entry) => entry.users > 0);
  const quiet = rooms.filter((entry) => entry.users === 0);
  const suggestions = SUGGESTED.filter(
    (name) => !rooms.some((entry) => entry.room === name),
  ).map((name) => ({ room: name, users: 0 }));

  const options = [...active, ...quiet, ...suggestions].slice(0, 8);

  if (status === 'error') {
    return (
      <p className="rounded-clay bg-elevated px-3.5 py-2.5 text-xs text-fg-muted shadow-clay-in">
        Room list unavailable. Type a room name below.
      </p>
    );
  }

  if (status === 'loading') {
    return <p className="text-xs text-fg-subtle">Loading rooms…</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((entry) => {
        const selected = entry.room === value;
        return (
          <button
            key={entry.room}
            type="button"
            onClick={() => onSelect(entry.room)}
            aria-pressed={selected}
            className={`group flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold transition-transform ${
              selected
                ? 'bg-accent text-accent-fg shadow-clay-accent'
                : 'bg-surface text-fg-muted shadow-clay-sm hover:-translate-y-0.5 hover:text-fg'
            }`}
          >
            <span>{entry.room}</span>
            {entry.users > 0 && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  selected ? 'text-accent-fg' : 'text-success'
                }`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                {entry.users}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
