const STATES = {
  connected: { label: 'Connected', dot: 'bg-success', text: 'text-success' },
  connecting: { label: 'Reconnecting', dot: 'bg-warning animate-pulse', text: 'text-warning' },
  disconnected: { label: 'Offline', dot: 'bg-danger', text: 'text-danger' },
};

export function ConnectionBadge({ status }) {
  const state = STATES[status] ?? STATES.disconnected;

  return (
    <span className={`flex items-center gap-1.5 text-xs font-bold ${state.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${state.dot}`} />
      {state.label}
    </span>
  );
}
