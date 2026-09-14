const IDENTITY_KEY = 'chat-identity';

export function rememberIdentity({ username, room }) {
  try {
    const keep = String(room || '').startsWith('p-') ? '' : room;
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ username, room: keep }));
  } catch (error) {
    return;
  }
}

export function readIdentity() {
  try {
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY) || '{}');
    const room = typeof stored.room === 'string' ? stored.room : '';
    return {
      username: typeof stored.username === 'string' ? stored.username : '',
      room: room.startsWith('p-') ? '' : room,
    };
  } catch (error) {
    return { username: '', room: '' };
  }
}
