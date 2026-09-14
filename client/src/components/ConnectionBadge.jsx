const STATES = {
  connected: { label: 'Connected', dot: 'bg-success', text: 'text-success' },
  connecting: { label: 'Reconnecting', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  disconnected: { label: 'Not connected', dot: 'bg-fg-subtle', text: 'text-fg-muted' },
};

export function ConnectionBadge({ status, unreachable }) {
  const state = STATES[status] ?? STATES.disconnected;

  const label =
    status === 'connecting' && unreachable === 'device'
      ? 'No internet'
      : status === 'connecting' && unreachable === 'server'
        ? 'Reaching the server'
        : state.label;

  return (
    <span className={`flex items-center gap-1.5 text-xs font-bold ${state.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${state.dot}`} />
      {label}
    </span>
  );
}
