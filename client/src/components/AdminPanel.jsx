import { useState } from 'react';
import { useAdmin } from '../hooks/useAdmin.js';
import { Notice } from '../components/Notice.jsx';

function ModerationRow({ user, onKick, onBan, protectedAccount }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState('');

  return (
    <li className="rounded-clay bg-elevated p-3 shadow-clay-in">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-fg">{user.username}</p>
          <p className="truncate text-xs text-fg-subtle">#{user.room}</p>
        </div>
        {protectedAccount ? (
          <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            account
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-sm hover:text-fg"
          >
            {open ? 'Close' : 'Manage'}
          </button>
        )}
      </div>

      {open && !protectedAccount && (
        <div className="mt-2.5 flex flex-col gap-2">
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
              className="flex-1 rounded-full bg-warning/15 px-2 py-2 text-xs font-bold text-warning shadow-clay-in hover:bg-warning/25"
            >
              Kick
            </button>
            <button
              type="button"
              onClick={() => onBan(user.username, user.room, reason, Number(minutes) || null)}
              className="flex-1 rounded-full bg-danger/15 px-2 py-2 text-xs font-bold text-danger shadow-clay-in hover:bg-danger/25"
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

        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
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
                protectedAccount={user.role === 'admin'}
              />
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
          Active bans
        </h3>
        {admin.bans.length === 0 ? (
          <p className="mt-2 text-xs text-fg-subtle">No bans in place.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {admin.bans.map((ban) => (
              <li
                key={ban.id}
                className="flex items-center justify-between gap-2 rounded-clay bg-elevated p-3 shadow-clay-in"
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
                  className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-sm hover:text-fg"
                >
                  Lift
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
          This room
        </h3>
        <div className="mt-2">
          {confirmClear ? (
            <div className="rounded-clay bg-danger/12 p-3 shadow-clay-in">
              <p className="text-xs text-danger">
                Delete every stored message in #{room}? This cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 rounded-full bg-surface px-2 py-2 text-xs font-bold text-fg-muted shadow-clay-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await admin.clearRoom(room);
                    setConfirmClear(false);
                  }}
                  className="flex-1 rounded-full bg-danger px-2 py-2 text-xs font-bold text-surface shadow-clay-accent"
                >
                  Clear it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="w-full rounded-full bg-surface px-3 py-2.5 text-xs font-bold text-fg-muted shadow-clay-sm hover:text-fg"
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
      className="scrollbar-soft flex w-full max-w-sm shrink-0 flex-col overflow-y-auto bg-surface px-4 py-5 shadow-[-10px_0_26px_-22px_var(--clay-drop)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-extrabold text-fg">Moderation</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-fg-muted shadow-clay-in hover:text-fg"
        >
          Close
        </button>
      </div>
      {body}
    </aside>
  );
}
