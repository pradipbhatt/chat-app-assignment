const TONES = {
  danger: 'bg-danger/12 text-danger',
  warning: 'bg-warning/12 text-warning',
  info: 'bg-elevated text-fg-muted',
};

export function Notice({ tone = 'info', title, children }) {
  return (
    <div role="alert" className={`rounded-clay px-3.5 py-2.5 text-sm shadow-clay-in ${TONES[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <p className={title ? 'mt-0.5 text-xs opacity-90' : 'text-sm'}>{children}</p>}
    </div>
  );
}
