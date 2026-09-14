import { initials, avatarTone } from '../lib/format.js';

const TONE_CLASS = {
  accent: 'bg-accent text-accent-fg',
  success: 'bg-success text-bg',
  warning: 'bg-warning text-bg',
  danger: 'bg-danger text-bg',
};

export function UserList({ users, username }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
        In this room · {users.length}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {users.map((user) => (
          <li key={user.username} className="flex items-center gap-2.5">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-[11px] font-bold shadow-clay-sm ${
                TONE_CLASS[avatarTone(user.username)]
              }`}
            >
              {initials(user.username)}
            </span>
            <span className="truncate text-sm text-fg">
              {user.username}
              {user.username === username && <span className="text-fg-subtle"> (you)</span>}
            </span>
            {user.role === 'admin' && (
              <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                admin
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
