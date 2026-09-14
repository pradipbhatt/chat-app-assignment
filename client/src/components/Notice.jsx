const TONES = {
  danger: 'border-danger/40 bg-danger/10 text-danger',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  info: 'border-border bg-elevated text-fg-muted',
};

export function Notice({ tone = 'info', title, children }) {
  return (
    <div role="alert" className={`rounded-md border px-3 py-2.5 text-sm ${TONES[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <p className={title ? 'mt-0.5 text-xs opacity-90' : 'text-sm'}>{children}</p>}
    </div>
  );
}
