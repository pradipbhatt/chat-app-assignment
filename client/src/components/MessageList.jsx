import { MessageBubble } from './MessageBubble.jsx';
import { PendingMessage } from './PendingMessage.jsx';
import { useAutoScroll } from '../hooks/useAutoScroll.js';

export function MessageList({
  messages,
  pending,
  username,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  onDiscard,
  canModerate,
  onDeleteMessage,
  roomCleared,
}) {
  const { containerRef, onScroll, hasNewBelow, scrollToBottom, captureBeforePrepend } =
    useAutoScroll(messages);

  const loadOlder = async () => {
    captureBeforePrepend();
    await onLoadOlder();
  };

  const empty = messages.length === 0 && pending.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="scrollbar-soft flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        <div className="mx-auto flex max-w-2xl flex-col">
          {hasMore && (
            <div className="mb-4 flex justify-center">
              <button
                type="button"
                onClick={loadOlder}
                disabled={loadingOlder}
                className="rounded-full bg-surface px-4 py-2 text-xs font-bold text-fg-muted shadow-clay-sm transition-transform hover:-translate-y-0.5 hover:text-fg disabled:opacity-50"
              >
                {loadingOlder ? 'Loading…' : 'Load older messages'}
              </button>
            </div>
          )}

          {empty && (
            <div className="py-16 text-center">
              {roomCleared ? (
                <>
                  <p className="text-sm text-fg-muted">This room was cleared.</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    An administrator deleted the stored history. New messages will appear here.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-fg-muted">No messages yet.</p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Say something, or open this room in another window to see it arrive live.
                  </p>
                </>
              )}
            </div>
          )}

          <ul aria-live="polite" className="flex flex-col gap-3">
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showAuthor =
                !previous ||
                previous.username !== message.username ||
                previous.system !== message.system;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={!message.system && message.username === username}
                  showAuthor={showAuthor}
                  canModerate={canModerate && !message.system}
                  onDelete={onDeleteMessage}
                />
              );
            })}

            {pending.map((entry) => (
              <PendingMessage
                key={entry.tempId}
                entry={entry}
                onRetry={onRetry}
                onDiscard={onDiscard}
              />
            ))}
          </ul>
        </div>
      </div>

      {hasNewBelow && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-2.5 font-display text-xs font-bold text-accent-fg shadow-clay-accent"
        >
          New messages ↓
        </button>
      )}
    </div>
  );
}
