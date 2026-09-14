const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTime(ts) {
  if (!ts) return '';
  return timeFormatter.format(new Date(ts));
}

export function initials(name) {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/[\s-_]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function avatarTone(name) {
  const tones = ['accent', 'success', 'warning', 'danger'];
  const text = String(name ?? '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return tones[hash % tones.length];
}
