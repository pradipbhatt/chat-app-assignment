import { randomUUID } from 'node:crypto';
import { validateUsername, validateRoom, validateText } from '../utils/validate.js';
import {
  addUser,
  removeUser,
  getUser,
  getRoomUsers,
  isNameTakenInRoom,
} from './rooms.js';

/**
 * Every client -> server event is handled here. Two rules hold throughout:
 *
 *   1. Nothing throws. Bad input emits `error:app` and the event is dropped.
 *   2. The server is the authority on message id, timestamp and ordering.
 *      Client-supplied ids or clocks would let one client's wrong system clock
 *      reorder the room for everybody.
 */

const RATE_LIMIT = { capacity: 5, refillPerSecond: 5 };
const TYPING_TIMEOUT_MS = 4000;

const sendError = (socket, code, message) => socket.emit('error:app', { code, message });

/** Server-stamped message envelope; the one place a message is constructed. */
const buildMessage = ({ username, text, system = false }) => ({
  id: randomUUID(),
  username,
  text,
  ts: Date.now(),
  system,
});

/**
 * Token bucket, one per socket. Without this, a single open tab can flood every
 * other client in the room with as fast as it can emit — the messages are
 * broadcast, so the cost lands on everyone, not just the sender.
 */
function createRateLimiter() {
  let tokens = RATE_LIMIT.capacity;
  let last = Date.now();

  return function take() {
    const now = Date.now();
    tokens = Math.min(
      RATE_LIMIT.capacity,
      tokens + ((now - last) / 1000) * RATE_LIMIT.refillPerSecond,
    );
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}

export function registerHandlers(io, socket) {
  const takeToken = createRateLimiter();

  /** Names currently typing, per room, kept out of the persistent registry. */
  let typingTimer = null;

  const broadcastUsers = (room) => io.to(room).emit('room:users', { users: getRoomUsers(room) });

  const stopTyping = (silent = false) => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    const user = getUser(socket.id);
    if (user && !silent) {
      socket.to(user.room).emit('typing:stop', { username: user.username });
    }
  };

  socket.on('room:join', (payload = {}) => {
    // Re-joining is legitimate: Socket.IO reconnects with a NEW socket id after
    // a server restart or a network drop, so the client re-sends room:join to
    // rebuild membership the server lost. Clear any previous identity first so
    // a reconnect cannot leave a ghost entry behind in the old room.
    const existing = getUser(socket.id);
    if (existing) {
      socket.leave(existing.room);
      removeUser(socket.id);
      broadcastUsers(existing.room);
    }

    const username = validateUsername(payload.username);
    if (!username.ok) return sendError(socket, username.code, username.message);

    const room = validateRoom(payload.room);
    if (!room.ok) return sendError(socket, room.code, room.message);

    // Names must be unique within a room. Otherwise two people called "Alice"
    // each see the other's messages rendered as their own, and the roster shows
    // a name that identifies two different people.
    if (isNameTakenInRoom(room.value, username.value)) {
      return sendError(
        socket,
        'USERNAME_TAKEN',
        `"${username.value}" is already in #${room.value}. Pick another name.`,
      );
    }

    socket.join(room.value);
    addUser(socket.id, username.value, room.value);

    // Acknowledge to the joiner first: the client switches views on this event,
    // not on transport `connect`, because being connected is not the same as
    // being in a room.
    socket.emit('room:joined', {
      room: room.value,
      username: username.value,
      users: getRoomUsers(room.value),
    });

    socket
      .to(room.value)
      .emit('message:new', buildMessage({ username: username.value, text: `${username.value} joined`, system: true }));

    broadcastUsers(room.value);
  });

  socket.on('message:send', (payload = {}) => {
    const user = getUser(socket.id);
    if (!user) return sendError(socket, 'NOT_IN_ROOM', 'Join a room before sending messages.');

    if (!takeToken()) {
      return sendError(socket, 'RATE_LIMITED', 'You are sending messages too quickly.');
    }

    const text = validateText(payload.text);
    if (!text.ok) return sendError(socket, text.code, text.message);

    stopTyping();

    // Broadcast to the whole room INCLUDING the sender, rather than using
    // socket.broadcast plus a local echo. One code path means every client
    // renders from the same event and sees the same ordering.
    io.to(user.room).emit('message:new', buildMessage({ username: user.username, text: text.value }));
  });

  socket.on('typing:start', () => {
    const user = getUser(socket.id);
    if (!user) return;

    socket.to(user.room).emit('typing:start', { username: user.username });

    // Self-expiring: a client that closes its tab mid-sentence never sends
    // typing:stop, and a typing indicator that never clears is worse than none.
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      typingTimer = null;
      socket.to(user.room).emit('typing:stop', { username: user.username });
    }, TYPING_TIMEOUT_MS);
  });

  socket.on('typing:stop', () => stopTyping());

  const departRoom = () => {
    stopTyping(true);
    const user = removeUser(socket.id);
    if (!user) return;

    socket.leave(user.room);
    io.to(user.room).emit(
      'message:new',
      buildMessage({ username: user.username, text: `${user.username} left`, system: true }),
    );
    broadcastUsers(user.room);
  };

  socket.on('room:leave', departRoom);
  socket.on('disconnect', departRoom);
}
