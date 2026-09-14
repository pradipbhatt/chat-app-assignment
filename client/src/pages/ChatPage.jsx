import { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MessageList } from '../components/MessageList.jsx';
import { MessageComposer } from '../components/MessageComposer.jsx';
import { UserList } from '../components/UserList.jsx';
import { ConnectionBadge } from '../components/ConnectionBadge.jsx';
import { ThemeSwitcher } from '../components/ThemeSwitcher.jsx';
import { Notice } from '../components/Notice.jsx';
import { AdminPanel } from '../components/AdminPanel.jsx';
import { emitWithAck } from '../lib/socket.js';

export function ChatPage() {
  const {
    session,
    messages,
    users,
    connection,
    notice,
    typingUsers,
    pending,
    hasMore,
    loadingOlder,
    send,
    leave,
    signalTyping,
    retryPending,
    discardPending,
    loadOlder,
  } = useChat();

  const { isAdmin } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);

  const offline = connection !== 'connected';
  const canModerate = isAdmin && session.role === 'admin';

  const deleteMessage = (id) => emitWithAck('admin:delete-message', { id });

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-fg">#{session.room}</h1>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="truncate text-xs text-fg-muted">{session.username}</span>
            {canModerate && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                admin
              </span>
            )}
            <span className="text-xs text-fg-subtle">·</span>
            <ConnectionBadge status={connection} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>
          {canModerate && (
            <button
              type="button"
              onClick={() => setPanelOpen((value) => !value)}
              aria-pressed={panelOpen}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                panelOpen
                  ? 'border-accent bg-accent text-accent-fg'
                  : 'border-border text-fg-muted hover:bg-elevated hover:text-fg'
              }`}
            >
              Moderate
            </button>
          )}
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
          <MessageList
            messages={messages}
            pending={pending}
            username={session.username}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlder}
            onRetry={retryPending}
            onDiscard={discardPending}
            canModerate={canModerate}
            onDeleteMessage={deleteMessage}
          />
          <MessageComposer
            onSend={send}
            onTyping={signalTyping}
            typingUsers={typingUsers}
            disabled={offline}
            disabledReason="You are offline. Messages cannot be sent until the connection returns."
          />
        </section>

        {canModerate && (
          <AdminPanel open={panelOpen} onClose={() => setPanelOpen(false)} room={session.room} />
        )}
      </div>
    </div>
  );
}
