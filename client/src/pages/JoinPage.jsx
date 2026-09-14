import { useState } from 'react';
import { TextField } from '../components/TextField.jsx';
import { RoomPicker } from '../components/RoomPicker.jsx';
import { Notice } from '../components/Notice.jsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.jsx';
import { useRooms } from '../hooks/useRooms.js';
import { validateUsername, validateRoom, normaliseRoom } from '../lib/validation.js';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { AdminSignInDialog } from '../components/AdminSignInDialog.jsx';

const FRIENDLY = {
  USERNAME_TAKEN: 'Someone in that room is already using this name.',
  USERNAME_RESERVED: 'That name belongs to a registered account. Pick another one.',
  USERNAME_MISMATCH: 'Signed-in administrators must join under their account name.',
  BANNED: 'You are not able to join that room.',
  ROOM_CHARSET: 'Use lowercase letters, numbers and hyphens only.',
  TIMEOUT: 'The server did not respond. Check that it is running.',
};

export function JoinPage() {
  const { rooms, status, refresh } = useRooms();
  const { join, notice, dismissNotice } = useChat();
  const { account, isAdmin, signOut } = useAuth();

  const [signInOpen, setSignInOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [touched, setTouched] = useState({ username: false, room: false });
  const [serverError, setServerError] = useState(null);
  const [joining, setJoining] = useState(false);

  const effectiveUsername = isAdmin ? account.username : username;
  const usernameError = validateUsername(effectiveUsername);
  const roomError = validateRoom(room);
  const canSubmit = !usernameError && !roomError && !joining;

  const selectRoom = (name) => {
    setRoom(name);
    setTouched((state) => ({ ...state, room: true }));
    setServerError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setTouched({ username: true, room: true });
    setServerError(null);

    if (usernameError || roomError) return;

    dismissNotice();
    setJoining(true);
    const response = await join(effectiveUsername, room);
    setJoining(false);

    if (!response.ok) {
      setServerError({
        code: response.code,
        message: FRIENDLY[response.code] || response.message || 'Could not join that room.',
      });
      refresh();
      return;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-6 py-5">
        <span className="text-sm font-medium text-fg-muted">Chat Room</span>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {isAdmin ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/20"
            >
              {account.username} · sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              Admin sign in
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Join a room</h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            Pick a name and a room. Anyone in the same room sees your messages instantly.
          </p>

          {notice && (
            <div className="mt-5">
              <Notice tone={notice.tone}>{notice.message}</Notice>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
            <TextField
              id="username"
              label="Display name"
              placeholder="Pradip"
              autoComplete="off"
              maxLength={24}
              value={effectiveUsername}
              disabled={isAdmin}
              hint={
                isAdmin
                  ? 'Signed in as an administrator, so your account name is used.'
                  : 'Visible to everyone in the room.'
              }
              error={touched.username ? usernameError : null}
              onChange={(event) => {
                setUsername(event.target.value);
                setServerError(null);
              }}
              onBlur={() => setTouched((state) => ({ ...state, username: true }))}
            />

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-fg">Room</span>
              <RoomPicker rooms={rooms} status={status} value={normaliseRoom(room)} onSelect={selectRoom} />
              <TextField
                id="room"
                label="Or type a room name"
                placeholder="research"
                autoComplete="off"
                maxLength={32}
                value={room}
                error={touched.room ? roomError : null}
                onChange={(event) => {
                  setRoom(event.target.value);
                  setServerError(null);
                }}
                onBlur={() => setTouched((state) => ({ ...state, room: true }))}
              />
            </div>

            {serverError && <Notice tone="danger">{serverError.message}</Notice>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </div>
      </main>

      <AdminSignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
