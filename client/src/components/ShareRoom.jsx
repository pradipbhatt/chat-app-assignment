import { useEffect, useState } from 'react';
import { copyRoomLink, roomUrl } from '../lib/roomLink.js';

export function ShareRoom({ room, compact = false }) {
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (state === 'idle') return undefined;
    const timer = setTimeout(() => setState('idle'), 2600);
    return () => clearTimeout(timer);
  }, [state]);

  const share = async () => {
    const result = await copyRoomLink(room);
    setState(result.ok ? 'copied' : 'failed');
  };

  const label = state === 'copied' ? 'Link copied' : state === 'failed' ? 'Press ⌘C' : 'Invite';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={share}
        aria-label={`Copy an invite link to ${room}`}
        className={`rounded-full px-3.5 py-2 font-display text-sm font-bold transition-transform hover:-translate-y-0.5 ${
          state === 'copied'
            ? 'bg-success text-bg shadow-clay-sm'
            : 'bg-surface text-fg-muted shadow-clay-sm hover:text-fg'
        }`}
      >
        {compact ? label : `${label}`}
      </button>
      {state === 'failed' && (
        <input
          readOnly
          value={roomUrl(room)}
          onFocus={(event) => event.target.select()}
          className="w-56 rounded-clay bg-elevated px-2.5 py-1.5 font-mono text-[11px] text-fg shadow-clay-in"
        />
      )}
    </div>
  );
}
