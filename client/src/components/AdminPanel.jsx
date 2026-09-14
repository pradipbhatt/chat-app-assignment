import { useState } from 'react';
import { useAdmin } from '../hooks/useAdmin.js';
import { Notice } from '../components/Notice.jsx';

function ModerationRow({ user, onKick, onBan }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');

  return (
    <li className="rounded-md border border-border bg-bg p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-fg">{user.username}</p>
          <p className="truncate text-xs text-fg-subtle">#{user.room}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="shrink-0 rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-elevated hover:text-fg"
        >
          {open ? 'Close' : 'Manage'}
        </button>
      </div>

      {open && (
        <div className="mt-2.5 flex flex-col gap-2">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (optional)"
            maxLength={200}
            className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle"
          />
          <input
            value={minutes}
            onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Ban minutes (blank = permanent)"
            inputMode="numeric"
            className="rounded border border-border bg-surface px-2 py-1.5 text-xs text-fg placeholder:text-fg-subtle"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onKick(user.username, user.room, reason)}
              className="flex-1 rounded bg-warning/15 px-2 py-1.5 text-xs font-medium text-warning hover:bg-warning/25"
            >
              Kick
            </button>
            <button
              type="button"
              onClick={() => onBan(user.username, user.room, reason, Number(minutes) || null)}
              className="flex-1 rounded bg-danger/15 px-2 py-1.5 text-xs font-medium text-danger hover:bg-danger/25"
            >
              Ban
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function AdminPanel({ open, onClose, room, embedded = false }) {
  const admin = useAdmin(open);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) return null;

  const body = (
    <>
      <div>
        {admin.overview.totals && (
          <p className="mb-3 text-xs text-fg-subtle">
            {admin.overview.totals.users} online · {admin.overview.totals.rooms} rooms
          </p>
        )}
        {admin.error && (
          <div className="mb-3">
            <Notice tone="danger">{admin.error}</Notice>
          </div>
        )}

        <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          Connected users
        </h3>
        {admin.overview.users.length === 0 ? (
          <p className="mt-2 text-xs text-fg-subtle">Nobody is connected.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
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

        <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-fg-subtle">
          Active bans
        </h3>
        {admin.bans.length === 0 ? (
          <p className="mt-2 text-xs text-fg-subtle">No bans in place.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {admin.bans.map((ban) => (
              <li
                key={ban.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{ban.username}</p>
                  <p className="truncate text-xs text-fg-subtle">
                    {ban.room ? `#${ban.room}` : 'everywhere'}
                    {ban.reason ? ` · ${ban.reason}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => admin.unban(ban.id)}
                  className="shrink-0 rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-elevated hover:text-fg"
                >
                  Lift
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-fg-subtle">
          This room
        </h3>
        <div className="mt-2">
          {confirmClear ? (
            <div className="rounded-md border border-danger/40 bg-danger/10 p-3">
              <p className="text-xs text-danger">
                Delete every stored message in #{room}? This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 rounded border border-border px-2 py-1.5 text-xs text-fg-muted hover:bg-elevated"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await admin.clearRoom(room);
                    setConfirmClear(false);
                  }}
                  className="flex-1 rounded bg-danger px-2 py-1.5 text-xs font-medium text-bg"
                >
                  Clear it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="w-full rounded-md border border-border px-3 py-2 text-xs text-fg-muted hover:bg-elevated hover:text-fg"
            >
              Clear #{room} history
            </button>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return body;

  return (
    <aside
      aria-label="Moderation"
      className="flex w-full max-w-sm shrink-0 flex-col overflow-y-auto border-l border-border bg-surface px-4 py-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Moderation</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-border px-2 py-1 text-xs text-fg-muted hover:bg-elevated hover:text-fg"
        >
          Close
        </button>
      </div>
      {body}
    </aside>
  );
}
