import { useCallback, useEffect, useRef, useState } from 'react';
import { emitWithAck, getSocket } from '../lib/socket.js';
import { decryptText, isEnvelope } from '../lib/crypto.js';
import { unwrapRoomKey, readPrivateRoom } from '../lib/escrowBridge.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatTime, initials, avatarTone } from '../lib/format.js';
import { Notice } from './Notice.jsx';

const TONE_CLASS = {
  accent: 'bg-accent text-accent-fg',
  success: 'bg-success text-bg',
  warning: 'bg-warning text-bg',
  danger: 'bg-danger text-bg',
};

export function RoomInspector({ rooms, escrowKey, onKick, onBan, onClear }) {
  const { token } = useAuth();
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');

  const roomKey = useRef(null);
  const endRef = useRef(null);

  const decode = useCallback(async (message) => {
    if (message.system || !isEnvelope(message.text)) return message;
    if (!roomKey.current) return { ...message, text: null, locked: true };
    const plain = await decryptText(roomKey.current, message.text);
    return plain === null ? { ...message, text: null, locked: true } : { ...message, text: plain };
  }, []);

  useEffect(() => {
    if (!selected) return undefined;

    let active = true;
    const socket = getSocket();

    const onMessage = async (message) => {
      const readable = await decode(message);
      if (active) setMessages((current) => [...current, readable]);
    };
    const onUsers = (payload) => active && setUsers(payload.users ?? []);
    const onDeleted = (payload) =>
      active && setMessages((current) => current.filter((entry) => entry.id !== payload.id));
    const onCleared = () => active && setMessages([]);

    const load = async () => {
      setState('loading');
      setError(null);
      roomKey.current = null;

      const response = await emitWithAck('admin:observe', { room: selected });
      if (!active) return;

      if (!response.ok) {
        setError(response.message);
        setState('error');
        return;
      }

      setIsPrivate(Boolean(response.private));
      setUsers(response.users ?? []);

      if (response.private && escrowKey) {
        try {
          const stored = await readPrivateRoom(selected, token);
          if (stored.wrappedKey) roomKey.current = await unwrapRoomKey(escrowKey, stored.wrappedKey);
        } catch (requestError) {
          roomKey.current = null;
        }
      }

      setMessages(await Promise.all((response.messages ?? []).map(decode)));
      setState('ready');
    };

    socket.on('message:new', onMessage);
    socket.on('room:users', onUsers);
    socket.on('message:deleted', onDeleted);
    socket.on('room:cleared', onCleared);
    load();

    return () => {
      active = false;
      socket.off('message:new', onMessage);
      socket.off('room:users', onUsers);
      socket.off('message:deleted', onDeleted);
      socket.off('room:cleared', onCleared);
      emitWithAck('admin:unobserve');
    };
  }, [selected, escrowKey, token, decode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const act = async (kind) => {
    if (!target) return;
    const run = kind === 'kick' ? onKick : onBan;
    await run(target, selected, reason);
    setTarget(null);
    setReason('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
          Room inspector
        </h2>
        <span className="rounded-full bg-elevated px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-fg-muted shadow-clay-in">
          view only
        </span>
      </div>

      <label htmlFor="room-switch" className="sr-only">
        Choose a room to inspect
      </label>
      <select
        id="room-switch"
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          setMessages([]);
          setUsers([]);
          setConfirmClear(false);
          setTarget(null);
        }}
        className="w-full rounded-clay bg-elevated px-3.5 py-2.5 text-sm font-bold text-fg shadow-clay-in"
      >
        <option value="">Select a room…</option>
        {rooms.map((room) => (
          <option key={room.room} value={room.room}>
            {room.private ? '🔒 ' : '# '}
            {room.room} · {room.users} online
          </option>
        ))}
        {selected && !rooms.some((room) => room.room === selected) && (
          <option value={selected}>
            {selected.startsWith('p-') ? '🔒 ' : '# '}
            {selected} · 0 online
          </option>
        )}
      </select>

      {!selected && (
        <p className="text-xs text-fg-subtle">
          Pick a room to watch it live. You will not appear in it and cannot post.
        </p>
      )}

      {error && <Notice tone="danger">{error}</Notice>}

      {selected && state !== 'error' && (
        <>
          {isPrivate && !roomKey.current && (
            <Notice tone="warning">
              This room is encrypted and no key is open, so the conversation stays unreadable.
              Unlock the review key below.
            </Notice>
          )}

          <div className="scrollbar-soft max-h-72 overflow-y-auto rounded-clay bg-bg p-3 shadow-clay-in">
            {state === 'loading' && <p className="text-xs text-fg-subtle">Opening the room…</p>}
            {state === 'ready' && messages.length === 0 && (
              <p className="text-xs text-fg-subtle">Nothing has been said here.</p>
            )}

            <ul className="flex flex-col gap-1.5">
              {messages.map((message) => (
                <li key={message.id} className="text-[11px] leading-snug">
                  {message.system ? (
                    <span className="italic text-fg-subtle">{message.text}</span>
                  ) : (
                    <>
                      <span className="font-mono text-fg-subtle">{formatTime(message.ts)} </span>
                      <span className="font-bold text-fg">{message.username}: </span>
                      <span className={message.locked ? 'italic text-fg-subtle' : 'text-fg-muted'}>
                        {message.locked ? 'encrypted' : message.text}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div ref={endRef} />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">
              In this room · {users.length}
            </h3>
            {users.length === 0 ? (
              <p className="text-xs text-fg-subtle">Nobody is here right now.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {users.map((user) => (
                  <li key={user.username}>
                    <button
                      type="button"
                      onClick={() => setTarget(target === user.username ? null : user.username)}
                      aria-pressed={target === user.username}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-bold shadow-clay-sm ${
                        target === user.username
                          ? 'bg-accent text-accent-fg'
                          : 'bg-surface text-fg-muted hover:text-fg'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${
                          TONE_CLASS[avatarTone(user.username)]
                        }`}
                      >
                        {initials(user.username)}
                      </span>
                      {user.username}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {target && (
              <div className="flex flex-col gap-2 rounded-clay bg-elevated p-2.5 shadow-clay-in">
                <p className="text-[11px] text-fg-muted">
                  Acting on <span className="font-bold text-fg">{target}</span> in #{selected}
                </p>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason (optional)"
                  maxLength={200}
                  className="rounded-clay bg-surface px-3 py-2 text-xs text-fg shadow-clay-in placeholder:text-fg-subtle"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act('kick')}
                    className="flex-1 rounded-full bg-warning/15 px-2 py-2 text-[11px] font-bold text-warning shadow-clay-in"
                  >
                    Remove from room
                  </button>
                  <button
                    type="button"
                    onClick={() => act('ban')}
                    className="flex-1 rounded-full bg-danger/15 px-2 py-2 text-[11px] font-bold text-danger shadow-clay-in"
                  >
                    Ban from room
                  </button>
                </div>
              </div>
            )}

            {confirmClear ? (
              <div className="rounded-clay bg-danger/12 p-2.5 shadow-clay-in">
                <p className="text-[11px] text-danger">
                  Delete every message in #{selected}? This cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="flex-1 rounded-full bg-surface px-2 py-2 text-[11px] font-bold text-fg-muted shadow-clay-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onClear(selected);
                      setConfirmClear(false);
                    }}
                    className="flex-1 rounded-full bg-danger px-2 py-2 text-[11px] font-bold text-surface shadow-clay-accent"
                  >
                    Clear it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="w-full rounded-full bg-surface px-3 py-2 text-[11px] font-bold text-fg-muted shadow-clay-sm hover:text-fg"
              >
                Clear this conversation
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
