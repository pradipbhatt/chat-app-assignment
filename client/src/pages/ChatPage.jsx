import { useChat } from '../context/ChatContext.jsx';
import { MessageList } from '../components/MessageList.jsx';
import { MessageComposer } from '../components/MessageComposer.jsx';
import { UserList } from '../components/UserList.jsx';
import { ConnectionBadge } from '../components/ConnectionBadge.jsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.jsx';
import { Notice } from '../components/Notice.jsx';

export function ChatPage() {
  const { session, messages, users, connection, notice, send, leave } = useChat();
  const offline = connection !== 'connected';

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-fg">#{session.room}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-xs text-fg-muted">{session.username}</span>
            <span className="text-xs text-fg-subtle">·</span>
            <ConnectionBadge status={connection} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
          <button
            type="button"
            onClick={leave}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Leave
          </button>
        </div>
      </header>

      {notice && (
        <div className="px-4 pt-3 sm:px-6">
          <Notice tone={notice.tone}>{notice.message}</Notice>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface px-4 py-5 md:block">
          <UserList users={users} username={session.username} />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <MessageList messages={messages} username={session.username} />
          <MessageComposer
            onSend={send}
            disabled={offline}
            disabledReason="You are offline. Messages cannot be sent until the connection returns."
          />
        </section>
      </div>
    </div>
  );
}
