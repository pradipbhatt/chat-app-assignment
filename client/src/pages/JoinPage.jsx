import { useState } from 'react';
import { TextField } from '../components/TextField.jsx';
import { RoomPicker } from '../components/RoomPicker.jsx';
import { Notice } from '../components/Notice.jsx';
import { SettingsButton } from '../components/SettingsButton.jsx';
import { SettingsDialog } from '../components/SettingsDialog.jsx';
import { useRooms } from '../hooks/useRooms.js';
import { validateUsername, validateRoom, normaliseRoom } from '../lib/validation.js';
import { readIdentity } from '../lib/identity.js';
import { readRoomFromUrl } from '../lib/roomLink.js';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { AdminSignInDialog } from '../components/AdminSignInDialog.jsx';

const FRIENDLY = {
  USERNAME_TAKEN: 'Someone in that room is already using this name.',
  USERNAME_RESERVED: 'That name belongs to a registered account. Pick another one.',
  USERNAME_MISMATCH: 'Signed-in administrators must join under their account name.',
  BANNED: 'You are not able to join that room.',
  ROOM_EXPIRED: 'That private room has closed. Ask whoever shared it for a new link.',
  PASSCODE_INVALID: 'That passcode does not match this room.',
  PASSCODE_THROTTLED: 'Too many wrong passcodes. Wait a few minutes and try again.',
  ROOM_CHARSET: 'Use lowercase letters, numbers and hyphens only.',
  TIMEOUT: 'The server did not respond. Check that it is running.',
};

export function JoinPage() {
  const { rooms, status, refresh } = useRooms();
  const { join, createRoom, notice, dismissNotice } = useChat();
  const { account, isAdmin, signOut } = useAuth();

  const [signInOpen, setSignInOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remembered] = useState(readIdentity);
  const [invitedRoom] = useState(readRoomFromUrl);
  const [username, setUsername] = useState(remembered.username);
  const [room, setRoom] = useState(invitedRoom || remembered.room);
  const [passcode, setPasscode] = useState('');
  const [touched, setTouched] = useState({ username: false, room: false });
  const [serverError, setServerError] = useState(null);
  const [joining, setJoining] = useState(false);

  const effectiveUsername = isAdmin ? account.username : username;
  const privateTarget = normaliseRoom(room).startsWith('p-');
  const needsPasscode = privateTarget && !isAdmin;
  const usernameError = validateUsername(effectiveUsername);
  const roomError = validateRoom(room);
  const canSubmit =
    !usernameError && !roomError && !joining && (!needsPasscode || passcode.trim().length >= 4);

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
    const response = await join(effectiveUsername, room, passcode);
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
        <span className="font-display text-lg font-extrabold text-fg">Chat Room</span>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-full bg-accent px-4 py-2 font-display text-sm font-bold text-accent-fg shadow-clay-accent transition-transform hover:-translate-y-0.5"
            >
              {account.username} · sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="rounded-full bg-surface px-4 py-2 font-display text-sm font-bold text-fg-muted shadow-clay-sm transition-transform hover:-translate-y-0.5 hover:text-fg"
            >
              Admin sign in
            </button>
          )}
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md rounded-panel bg-surface p-7 shadow-clay sm:p-8">
          <h1 className="font-display text-4xl font-extrabold text-fg">
            {invitedRoom ? `Join #${invitedRoom}` : 'Join a room'}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">
            {invitedRoom
              ? 'Someone shared this room with you. Pick a name to come in.'
              : 'Pick a name and a room. Anyone in the same room sees your messages instantly.'}
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
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-fg">Room</span>
                <button
                  type="button"
                  disabled={joining || Boolean(usernameError)}
                  onClick={async () => {
                    setServerError(null);
                    setJoining(true);
                    const created = await createRoom(effectiveUsername);
                    if (!created.ok) {
                      setJoining(false);
                      setServerError({ message: created.message || 'Could not create a room.' });
                      return;
                    }
                    const response = await join(effectiveUsername, created.room, created.passcode);
                    setJoining(false);
                    if (!response.ok) {
                      setServerError({ message: FRIENDLY[response.code] || response.message });
                    }
                  }}
                  className="rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-in hover:text-fg disabled:opacity-50"
                >
                  Start a private room
                </button>
              </div>
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

            {needsPasscode && (
              <TextField
                id="passcode"
                label="Room passcode"
                placeholder="ABC234"
                autoComplete="off"
                maxLength={6}
                value={passcode}
                hint="Shared by whoever created the room, alongside the link."
                onChange={(event) => {
                  setPasscode(event.target.value.toUpperCase());
                  setServerError(null);
                }}
              />
            )}

            {serverError && <Notice tone="danger">{serverError.message}</Notice>}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-full bg-accent px-4 py-3 font-display text-base font-bold text-accent-fg shadow-clay-accent transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </div>
      </main>

      <AdminSignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
