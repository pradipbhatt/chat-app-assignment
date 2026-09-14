import { useEffect, useState } from 'react';
import { roomUrl } from '../lib/roomLink.js';

export function ShareRoom({ room, passcode = null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(''), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  const url = roomUrl(room);
  const invite = passcode ? `${url}\nPasscode: ${passcode}` : url;

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
    } catch (error) {
      setCopied('failed');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`rounded-full px-3.5 py-2 font-display text-sm font-bold transition-transform hover:-translate-y-0.5 ${
          open ? 'bg-accent text-accent-fg shadow-clay-accent' : 'bg-surface text-fg-muted shadow-clay-sm hover:text-fg'
        }`}
      >
        Invite
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-panel bg-surface p-4 shadow-clay">
          <h2 className="font-display text-base font-extrabold">Invite to #{room}</h2>
          <p className="mt-0.5 text-xs text-fg-muted">
            {passcode
              ? 'Both parts are needed — send the link and the passcode together.'
              : 'Anyone with this link can join.'}
          </p>

          <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
            Link
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <input
              readOnly
              value={url}
              onFocus={(event) => event.target.select()}
              className="min-w-0 flex-1 rounded-clay bg-elevated px-2.5 py-1.5 font-mono text-[11px] text-fg shadow-clay-in"
            />
            <button
              type="button"
              onClick={() => copy(url, 'link')}
              className="shrink-0 rounded-full bg-elevated px-2.5 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-in hover:text-fg"
            >
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>

          {passcode && (
            <>
              <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
                Passcode
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  readOnly
                  value={passcode}
                  onFocus={(event) => event.target.select()}
                  className="min-w-0 flex-1 rounded-clay bg-elevated px-2.5 py-1.5 text-center font-mono text-base font-medium tracking-[0.3em] text-fg shadow-clay-in"
                />
                <button
                  type="button"
                  onClick={() => copy(passcode, 'code')}
                  className="shrink-0 rounded-full bg-elevated px-2.5 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-in hover:text-fg"
                >
                  {copied === 'code' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => copy(invite, 'both')}
            className="mt-4 w-full rounded-full bg-accent px-3 py-2 font-display text-sm font-bold text-accent-fg shadow-clay-accent"
          >
            {copied === 'both' ? 'Invite copied' : 'Copy the whole invite'}
          </button>

          {copied === 'failed' && (
            <p className="mt-2 text-[11px] text-warning">
              Copying was blocked — select the text above and copy it by hand.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
