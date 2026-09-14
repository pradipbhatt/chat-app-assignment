import { useState } from 'react';
import { useChat } from '../context/ChatContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { MessageList } from '../components/MessageList.jsx';
import { MessageComposer } from '../components/MessageComposer.jsx';
import { UserList } from '../components/UserList.jsx';
import { ConnectionBadge } from '../components/ConnectionBadge.jsx';
import { ShareRoom } from '../components/ShareRoom.jsx';
import { SettingsButton } from '../components/SettingsButton.jsx';
import { SettingsDialog } from '../components/SettingsDialog.jsx';
import { Notice } from '../components/Notice.jsx';
import { AdminPanel } from '../components/AdminPanel.jsx';
import { SlideOver } from '../components/SlideOver.jsx';
import { emitWithAck } from '../lib/socket.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';

export function ChatPage() {
  const {
    session,
    messages,
    users,
    connection,
    unreachable,
    notice,
    typingUsers,
    pending,
    hasMore,
    loadingOlder,
    roomCleared,
    privateRoom,
    send,
    leave,
    signalTyping,
    retryPending,
    discardPending,
    loadOlder,
  } = useChat();

  const { isAdmin } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wideScreen = useMediaQuery('(min-width: 768px)');

  const offline = connection !== 'connected';
  const canModerate = isAdmin && session.role === 'admin';

  const deleteMessage = (id) => emitWithAck('admin:delete-message', { id, room: session.room });

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-3 bg-surface px-4 py-3 shadow-[0_10px_26px_-20px_var(--clay-drop)] sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-extrabold text-fg">#{session.room}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {privateRoom && (
              <span
                title={
                  privateRoom.encrypted
                    ? 'Encrypted in your browser. An administrator with the review key can open it.'
                    : 'Private, but this tab has no key so messages cannot be read.'
                }
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-clay-in ${
                  privateRoom.encrypted ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                }`}
              >
                {privateRoom.encrypted ? 'encrypted' : 'no key'}
              </span>
            )}
            <span className="truncate text-xs text-fg-muted">{session.username}</span>
            {canModerate && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                admin
              </span>
            )}
            <span className="hidden text-xs text-fg-subtle sm:inline">·</span>
            <ConnectionBadge status={connection} unreachable={unreachable} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ShareRoom
            room={session.room}
            passcode={privateRoom?.passcode ?? null}
            secret={privateRoom?.secret ?? null}
          />

          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            className="rounded-full bg-surface px-3.5 py-2 text-sm font-bold text-fg-muted shadow-clay-sm transition-transform hover:-translate-y-0.5 hover:text-fg md:hidden"
          >
            {users.length} online
          </button>

          {canModerate && (
            <button
              type="button"
              onClick={() => setPanelOpen((value) => !value)}
              aria-pressed={panelOpen}
              className={`rounded-full px-3.5 py-2 font-display text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                panelOpen
                  ? 'bg-accent text-accent-fg shadow-clay-accent'
                  : 'bg-surface text-fg-muted shadow-clay-sm hover:text-fg'
              }`}
            >
              Moderate
            </button>
          )}

          <button
            type="button"
            onClick={leave}
            className="rounded-full bg-surface px-3.5 py-2 font-display text-sm font-bold text-fg-muted shadow-clay-sm transition-transform hover:-translate-y-0.5 hover:text-fg"
          >
            Leave
          </button>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      {notice && (
        <div className="px-4 pt-3 sm:px-6">
          <Notice tone={notice.tone}>{notice.message}</Notice>
        </div>
      )}

      {privateRoom && (
        <div className="px-4 pt-3 sm:px-6">
          <Notice tone={privateRoom.reviewable ? 'warning' : 'info'}>
            {privateRoom.reviewable
              ? 'Encrypted in your browser — and an administrator can open this room for review.'
              : 'Encrypted in your browser. Only people with the link and passcode can read it.'}
          </Notice>
        </div>
      )}

      {privateRoom && messages.length === 0 && (
        <div className="px-4 pt-3 sm:px-6">
          <Notice tone="info">
            Send someone the full invite link and the passcode from Invite. The room closes once
            everyone leaves.
          </Notice>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="People in this room"
          className="scrollbar-soft hidden w-60 shrink-0 overflow-y-auto bg-surface px-4 py-5 shadow-[10px_0_26px_-22px_var(--clay-drop)] md:block"
        >
          <UserList users={users} username={session.username} />
        </aside>

        <section aria-label="Conversation" className="flex min-w-0 flex-1 flex-col">
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
            roomCleared={roomCleared}
          />
          <MessageComposer
            onSend={send}
            onTyping={signalTyping}
            typingUsers={typingUsers}
            disabled={offline}
            disabledReason={
              unreachable === 'device'
                ? 'Your device is offline.'
                : 'The server is not answering yet — it may be waking up.'
            }
          />
        </section>

        {canModerate && panelOpen && wideScreen && (
          <AdminPanel open onClose={() => setPanelOpen(false)} room={session.room} />
        )}
      </div>

      <SlideOver open={membersOpen} onClose={() => setMembersOpen(false)} title="In this room">
        <UserList users={users} username={session.username} />
      </SlideOver>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {canModerate && !wideScreen && (
        <SlideOver open={panelOpen} onClose={() => setPanelOpen(false)} title="Moderation">
          <AdminPanel open onClose={() => setPanelOpen(false)} room={session.room} embedded />
        </SlideOver>
      )}
    </div>
  );
}
