import { io } from 'socket.io-client';
import { SERVER_URL } from './api.js';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function setSocketToken(token) {
  const instance = getSocket();
  instance.auth = token ? { token } : {};
}

export function connectSocket() {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
}

export function emitWithAck(event, payload = {}, timeoutMs = 8000) {
  const instance = getSocket();

  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, code: 'TIMEOUT', message: 'The server did not respond. Try again.' });
    }, timeoutMs);

    instance.emit(event, payload, (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response ?? { ok: false, code: 'NO_RESPONSE', message: 'No response from server.' });
    });
  });
}
