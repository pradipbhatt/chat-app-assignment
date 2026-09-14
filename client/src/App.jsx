import { useState } from 'react';
import { JoinPage } from './pages/JoinPage.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { getSocket } from './lib/socket.js';

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) return <JoinPage onJoined={setSession} />;

  const leave = () => {
    const socket = getSocket();
    socket.emit('room:leave');
    socket.disconnect();
    setSession(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-sm font-medium text-fg">#{session.room}</p>
          <p className="text-xs text-fg-muted">
            {session.username} · {session.role} · {session.users.length} online
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={leave}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Leave
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="text-sm text-fg-muted">
            Joined successfully with {session.history.length} message
            {session.history.length === 1 ? '' : 's'} of history.
          </p>
          <p className="mt-2 text-xs text-fg-subtle">
            The chat view arrives in the next sprint.
          </p>
        </div>
      </main>
    </div>
  );
}
