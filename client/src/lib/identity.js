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

const SESSION_KEY = 'chat-session';

export function rememberSession({ username, room, secret }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, room, secret: secret || '' }));
  } catch (error) {
    return;
  }
}

export function readSession() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!stored || typeof stored.username !== 'string' || typeof stored.room !== 'string') {
      return null;
    }
    return stored;
  } catch (error) {
    return null;
  }
}

export function forgetSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    return;
  }
}
