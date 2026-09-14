import { useEffect, useState } from 'react';
import { Notice } from './Notice.jsx';
import { EscrowSetup } from './EscrowSetup.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { decryptText, isEnvelope } from '../lib/crypto.js';
import { listPrivateRooms, readPrivateRoom, unwrapRoomKey } from '../lib/escrowBridge.js';
import { useReviewKey } from '../context/ReviewKeyContext.jsx';
import { UnlockReview } from './UnlockReview.jsx';
import { formatTime } from '../lib/format.js';

export function PrivateReview({ open }) {
  const { token } = useAuth();
  const { key: privateKey, status: keyStatus, refresh } = useReviewKey();
  const [rooms, setRooms] = useState([]);
  const [transcript, setTranscript] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || keyStatus !== 'open') return;

    let active = true;
    listPrivateRooms(token)
      .then((data) => active && setRooms(data.rooms ?? []))
      .catch((requestError) => active && setError(requestError.message));

    return () => {
      active = false;
    };
  }, [open, keyStatus, token]);

  const readRoom = async (room) => {
    setBusy(true);
    setError(null);
    setTranscript(null);

    try {
      const data = await readPrivateRoom(room, token);
      if (!data.wrappedKey) {
        setTranscript({ room, lines: [], note: 'This room was created without a review key.' });
        setBusy(false);
        return;
      }

      const roomKey = await unwrapRoomKey(privateKey, data.wrappedKey);
      if (!roomKey) {
        setTranscript({ room, lines: [], note: 'The review key does not open this room.' });
        setBusy(false);
        return;
      }

      const lines = [];
      for (const message of data.messages) {
        const text = isEnvelope(message.text)
          ? await decryptText(roomKey, message.text)
          : message.text;
        lines.push({ ...message, text: text ?? '[could not decrypt]' });
      }

      setTranscript({ room, lines, note: null });
    } catch (requestError) {
      setError(requestError.message);
    }

    setBusy(false);
  };

  if (!open) return null;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
        Private room review
      </h3>

      {keyStatus === 'checking' && (
        <p className="text-xs text-fg-subtle">Checking for a review key…</p>
      )}

      {keyStatus === 'absent' && (
        <>
          <p className="text-xs text-fg-muted">
            No review key exists yet. Until one does, private rooms cannot be read by anyone but
            their members — including you.
          </p>
          <EscrowSetup onDone={refresh} />
        </>
      )}

      {keyStatus === 'locked' && <UnlockReview />}

      {keyStatus === 'open' && (
        <>
          {error && <Notice tone="danger">{error}</Notice>}

          {rooms.length === 0 ? (
            <p className="text-xs text-fg-subtle">No private rooms have been recorded.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rooms.map((entry) => (
                <li key={entry.room} className="rounded-clay bg-elevated p-3.5 shadow-clay-in">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] text-fg">{entry.room}</p>
                      <p className="text-[10px] text-fg-subtle">
                        {entry.createdBy} · {entry.messages} message
                        {entry.messages === 1 ? '' : 's'}
                        {entry.hasKey ? '' : ' · no review key'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => readRoom(entry.room)}
                      disabled={busy}
                      className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-sm hover:text-fg disabled:opacity-50"
                    >
                      Read
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {transcript && (
            <div className="rounded-clay bg-bg p-4 shadow-clay-in">
              <p className="font-mono text-[10px] uppercase tracking-wide text-fg-subtle">
                {transcript.room}
              </p>
              {transcript.note ? (
                <p className="mt-1.5 text-[11px] text-warning">{transcript.note}</p>
              ) : (
                <ul className="scrollbar-soft mt-2.5 flex max-h-56 flex-col gap-2 overflow-y-auto">
                  {transcript.lines.map((line) => (
                    <li key={line.id} className="text-[11px] leading-snug">
                      <span className="font-mono text-fg-subtle">{formatTime(line.ts)} </span>
                      <span className="font-bold text-fg">{line.username}: </span>
                      <span className="text-fg-muted">{line.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
