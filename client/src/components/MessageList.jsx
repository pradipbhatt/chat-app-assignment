import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble.jsx';

export function MessageList({ messages, username }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-xs text-center">
          <p className="text-sm text-fg-muted">No messages yet.</p>
          <p className="mt-1 text-xs text-fg-subtle">
            Say something, or open this room in another window to see it arrive live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      <ul aria-live="polite" className="mx-auto flex max-w-2xl flex-col gap-3">
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showAuthor =
            !previous || previous.username !== message.username || previous.system !== message.system;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              own={!message.system && message.username === username}
              showAuthor={showAuthor}
            />
          );
        })}
      </ul>
      <div ref={endRef} />
    </div>
  );
}
