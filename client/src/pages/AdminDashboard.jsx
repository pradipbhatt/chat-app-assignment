import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useAdmin } from '../hooks/useAdmin.js';
import { TextField } from '../components/TextField.jsx';
import { Notice } from '../components/Notice.jsx';
import { ServerLogs } from '../components/ServerLogs.jsx';
import { PrivateReview } from '../components/PrivateReview.jsx';
import { RoomInspector } from '../components/RoomInspector.jsx';
import { SettingsButton } from '../components/SettingsButton.jsx';
import { SettingsDialog } from '../components/SettingsDialog.jsx';
import { connectSocket, getSocket } from '../lib/socket.js';

function SignIn() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(username.trim(), password);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }

    connectSocket();
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-panel bg-surface p-7 shadow-clay sm:p-8"
      >
        <h1 className="font-display text-3xl font-extrabold">Control room</h1>
        <p className="mt-1.5 text-sm text-fg-muted">Sign in to manage the chat service.</p>

        <div className="mt-6 flex flex-col gap-4">
          <TextField
            id="admin-username"
            label="Account name"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            id="admin-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && <Notice tone="danger">{error}</Notice>}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full rounded-full bg-accent px-4 py-3 font-display text-base font-bold text-accent-fg shadow-clay-accent disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </main>
  );
}

function ModerationRow({ user, onKick, onBan }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');
  const isAccount = user.role === 'admin';

  return (
    <li className="rounded-clay bg-elevated p-3 shadow-clay-in">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-fg">{user.username}</p>
          <p className="truncate font-mono text-[11px] text-fg-subtle">
            #{user.room}
            {user.private ? ' · private' : ''}
          </p>
        </div>
        {isAccount ? (
          <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            account
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-sm hover:text-fg"
          >
            {open ? 'Close' : 'Manage'}
          </button>
        )}
      </div>

      {open && !isAccount && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional)"
            maxLength={200}
            className="rounded-clay bg-surface px-3 py-2 text-xs text-fg shadow-clay-in placeholder:text-fg-subtle"
          />
          <input
            value={minutes}
            onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Ban minutes (blank = permanent)"
            inputMode="numeric"
            className="rounded-clay bg-surface px-3 py-2 text-xs text-fg shadow-clay-in placeholder:text-fg-subtle"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onKick(user.username, user.room, reason)}
              className="flex-1 rounded-full bg-warning/15 px-2 py-2 text-xs font-bold text-warning shadow-clay-in"
            >
              Kick
            </button>
            <button
              type="button"
              onClick={() => onBan(user.username, user.room, reason, Number(minutes) || null)}
              className="flex-1 rounded-full bg-danger/15 px-2 py-2 text-xs font-bold text-danger shadow-clay-in"
            >
              Ban
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function Dashboard() {
  const { account, signOut } = useAuth();
  const [socketReady, setSocketReady] = useState(() => getSocket().connected);
  const admin = useAdmin(socketReady);

  useEffect(() => {
    const socket = connectSocket();
    if (socket.connected) setSocketReady(true);

    const onConnect = () => setSocketReady(true);
    const onDisconnect = () => setSocketReady(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearing, setClearing] = useState('');
  const [escrowKey, setEscrowKey] = useState(null);

  return (
    <div className="min-h-[100dvh]">
      <header className="flex items-center justify-between gap-4 bg-surface px-5 py-4 shadow-[0_10px_26px_-20px_var(--clay-drop)] sm:px-8">
        <div>
          <h1 className="font-display text-xl font-extrabold leading-tight">Control room</h1>
          <p className="mt-0.5 text-xs text-fg-muted">Signed in as {account.username}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            className="rounded-full bg-surface px-3.5 py-2 font-display text-sm font-bold text-fg-muted shadow-clay-sm hover:text-fg"
          >
            Open chat
          </a>
          <button
            type="button"
            onClick={signOut}
            className="rounded-full bg-surface px-3.5 py-2 font-display text-sm font-bold text-fg-muted shadow-clay-sm hover:text-fg"
          >
            Sign out
          </button>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-2">
        <section className="rounded-panel bg-surface p-6 shadow-clay sm:p-7 lg:col-span-2">
          <ServerLogs open />
        </section>

        <section className="rounded-panel bg-surface p-6 shadow-clay sm:p-7">
          <RoomInspector
            rooms={admin.overview.rooms}
            escrowKey={escrowKey}
            onKick={(username, room, reason) => admin.kick(username, room, reason)}
            onBan={(username, room, reason) => admin.ban(username, room, reason, null)}
            onClear={(room) => admin.clearRoom(room)}
          />
        </section>

        <section className="rounded-panel bg-surface p-6 shadow-clay sm:p-7">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            Connected users
          </h2>
          {admin.error && (
            <div className="mt-3">
              <Notice tone="danger">{admin.error}</Notice>
            </div>
          )}
          {admin.overview.users.length === 0 ? (
            <p className="mt-4 text-xs text-fg-subtle">Nobody is connected.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {admin.overview.users.map((user) => (
                <ModerationRow
                  key={`${user.room}:${user.username}`}
                  user={user}
                  onKick={admin.kick}
                  onBan={admin.ban}
                />
              ))}
            </ul>
          )}

          <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            Rooms
          </h2>
          {admin.overview.rooms.length === 0 ? (
            <p className="mt-4 text-xs text-fg-subtle">No rooms are active.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {admin.overview.rooms.map((room) => (
                <li
                  key={room.room}
                  className="flex items-center justify-between gap-2 rounded-clay bg-elevated p-3 shadow-clay-in"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-fg">#{room.room}</p>
                    <p className="text-[10px] text-fg-subtle">
                      {room.users} online{room.private ? ' · private' : ''}
                    </p>
                  </div>
                  {clearing === room.room ? (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setClearing('')}
                        className="rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await admin.clearRoom(room.room);
                          setClearing('');
                        }}
                        className="rounded-full bg-danger px-2.5 py-1.5 text-[11px] font-bold text-surface shadow-clay-accent"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClearing(room.room)}
                      className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-sm hover:text-fg"
                    >
                      Clear
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-panel bg-surface p-6 shadow-clay sm:p-7">
          <PrivateReview open onUnlocked={setEscrowKey} />

          <h2 className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            Active bans
          </h2>
          {admin.bans.length === 0 ? (
            <p className="mt-4 text-xs text-fg-subtle">No bans in place.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {admin.bans.map((ban) => (
                <li
                  key={ban.id}
                  className="flex items-center justify-between gap-2 rounded-clay bg-elevated p-3 shadow-clay-in"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{ban.username}</p>
                    <p className="truncate text-[11px] text-fg-subtle">
                      {ban.room ? `#${ban.room}` : 'everywhere'}
                      {ban.reason ? ` · ${ban.reason}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => admin.unban(ban.id)}
                    className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11px] font-bold text-fg-muted shadow-clay-sm hover:text-fg"
                  >
                    Lift
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export function AdminDashboard() {
  const { isAdmin, restoring } = useAuth();

  if (restoring) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-fg-muted">Checking your session…</p>
      </main>
    );
  }

  return isAdmin ? <Dashboard /> : <SignIn />;
}
