const IDENTITY_KEY = 'chat-identity';

export function rememberIdentity({ username, room }) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ username, room }));
  } catch (error) {
    return;
  }
}

export function readIdentity() {
  try {
    const stored = JSON.parse(localStorage.getItem(IDENTITY_KEY) || '{}');
    return {
      username: typeof stored.username === 'string' ? stored.username : '',
      room: typeof stored.room === 'string' ? stored.room : '',
    };
  } catch (error) {
    return { username: '', room: '' };
  }
}
