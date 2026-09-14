export function TypingIndicator({ users }) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0]} is typing`
      : users.length === 2
        ? `${users[0]} and ${users[1]} are typing`
        : `${users.length} people are typing`;

  return (
    <div aria-live="polite" className="flex items-center gap-2 px-1 py-1 text-xs text-fg-muted">
      <span className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-fg-subtle"
          />
        ))}
      </span>
      {label}
    </div>
  );
}
