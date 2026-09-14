import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { saveMessage, getRecentMessages } from '../models/Message.js';
import { validateUsername, validateRoom, validateText } from '../utils/validate.js';
import { addUser, removeUser, getUser, getRoomUsers, isNameTakenInRoom } from './rooms.js';

const RATE_LIMIT = { capacity: 5, refillPerSecond: 5 };
const TYPING_TIMEOUT_MS = 4000;

const sendError = (socket, code, message) => socket.emit('error:app', { code, message });

const systemMessage = (text) => ({
  id: randomUUID(),
  username: 'system',
  text,
  ts: Date.now(),
  system: true,
});

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
  let typingTimer = null;

  const broadcastUsers = (room) => io.to(room).emit('room:users', { users: getRoomUsers(room) });

  const stopTyping = (silent = false) => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    const user = getUser(socket.id);
    if (user && !silent) socket.to(user.room).emit('typing:stop', { username: user.username });
  };

  socket.on('room:join', async (payload = {}) => {
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

    if (isNameTakenInRoom(room.value, username.value)) {
      return sendError(
        socket,
        'USERNAME_TAKEN',
        `"${username.value}" is already in #${room.value}. Pick another name.`,
      );
    }

    let history = [];
    try {
      history = await getRecentMessages(room.value, config.historyLimit);
    } catch (error) {
      console.error('[socket] failed to load history', error);
    }

    socket.join(room.value);
    addUser(socket.id, username.value, room.value);

    socket.emit('room:joined', {
      room: room.value,
      username: username.value,
      users: getRoomUsers(room.value),
      history,
    });

    socket.to(room.value).emit('message:new', systemMessage(`${username.value} joined`));
    broadcastUsers(room.value);
  });

  socket.on('message:send', async (payload = {}) => {
    const user = getUser(socket.id);
    if (!user) return sendError(socket, 'NOT_IN_ROOM', 'Join a room before sending messages.');

    if (!takeToken()) {
      return sendError(socket, 'RATE_LIMITED', 'You are sending messages too quickly.');
    }

    const text = validateText(payload.text);
    if (!text.ok) return sendError(socket, text.code, text.message);

    stopTyping();

    try {
      const message = await saveMessage({
        room: user.room,
        username: user.username,
        text: text.value,
      });
      io.to(user.room).emit('message:new', message);
    } catch (error) {
      console.error('[socket] failed to save message', error);
      sendError(socket, 'SEND_FAILED', 'Message could not be delivered. Try again.');
    }
  });

  socket.on('typing:start', () => {
    const user = getUser(socket.id);
    if (!user) return;

    socket.to(user.room).emit('typing:start', { username: user.username });

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
    io.to(user.room).emit('message:new', systemMessage(`${user.username} left`));
    broadcastUsers(user.room);
  };

  socket.on('room:leave', departRoom);
  socket.on('disconnect', departRoom);
}
