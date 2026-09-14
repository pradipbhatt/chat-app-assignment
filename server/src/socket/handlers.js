import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { saveMessage, getRecentMessages } from '../models/Message.js';
import { storeRoomKey } from '../models/RoomKey.js';
import { decryptEnvelope } from '../utils/escrowServer.js';
import { validateUsername, validateRoom, validateText, LIMITS } from '../utils/validate.js';
import { addUser, removeUser, getUser, getRoomUsers, isNameTakenInRoom } from './rooms.js';
import { consumeToken } from './rateLimit.js';
import { findActiveBan } from '../models/Ban.js';
import {
  isPrivateName,
  createPrivateRoom,
  getPrivateRoom,
  markOccupied,
  markEmpty,
  verifyPasscode,
  readPasscode,
  appendMessage,
  readMessages,
} from './privateRooms.js';
import { ROLES, isReservedUsername } from '../models/User.js';

const TYPING_TIMEOUT_MS = 4000;

const callable = (fn) => (typeof fn === 'function' ? fn : () => {});

const systemMessage = (text) => ({
  id: randomUUID(),
  username: 'system',
  text,
  ts: Date.now(),
  system: true,
});

export function registerHandlers(io, socket) {
  let typingTimer = null;

  const roomIsEmpty = (room) => getRoomUsers(room).length === 0;

  const broadcastUsers = (room) => io.to(room).emit('room:users', { users: getRoomUsers(room) });

  const reject = (socket_, respond, code, message) => {
    socket_.emit('error:app', { code, message });
    respond({ ok: false, code, message });
  };

  const stopTyping = (silent = false) => {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    const user = getUser(socket.id);
    if (user && !silent) socket.to(user.room).emit('typing:stop', { username: user.username });
  };

  socket.on('room:create', async (payload = {}, ack) => {
    const respond = callable(ack);

    const username = validateUsername(payload.username);
    if (!username.ok) return respond({ ok: false, code: username.code, message: username.message });

    const created = createPrivateRoom(username.value);

    if (typeof payload.wrappedKey === 'string' && payload.wrappedKey.length > 0) {
      try {
        await storeRoomKey({
          room: created.slug,
          wrappedKey: payload.wrappedKey.slice(0, 4000),
          createdBy: username.value,
          expiresAt: created.expiresAt,
        });
      } catch (error) {
        console.error('[socket] failed to store the wrapped room key', error);
      }
    }

    return respond({
      ok: true,
      room: created.slug,
      passcode: created.passcode,
      expiresAt: created.expiresAt,
      private: true,
    });
  });

  socket.on('room:join', async (payload = {}, ack) => {
    const respond = callable(ack);

    if (socket.data.joining) {
      return respond({ ok: false, code: 'JOIN_IN_FLIGHT', message: 'Already joining that room.' });
    }
    socket.data.joining = true;

    const finish = (result) => {
      socket.data.joining = false;
      return result;
    };

    const existing = getUser(socket.id);
    if (existing) {
      socket.leave(existing.room);
      removeUser(socket.id);
      broadcastUsers(existing.room);
    }

    const username = validateUsername(payload.username);
    if (!username.ok) return finish(reject(socket, respond, username.code, username.message));

    const room = validateRoom(payload.room);
    if (!room.ok) return finish(reject(socket, respond, room.code, room.message));

    let privateRoom = null;
    if (isPrivateName(room.value)) {
      privateRoom = getPrivateRoom(room.value);
      if (!privateRoom) {
        return finish(
          reject(
            socket,
            respond,
            'ROOM_EXPIRED',
            'That private room has closed. Ask for a new link.',
          ),
        );
      }

      if (socket.data.role !== ROLES.ADMIN) {
        const check = verifyPasscode(room.value, payload.passcode, socket.id);
        if (!check.ok) {
          const message =
            check.code === 'PASSCODE_THROTTLED'
              ? 'Too many wrong passcodes. Wait a few minutes and try again.'
              : check.code === 'ROOM_EXPIRED'
                ? 'That private room has closed. Ask for a new link.'
                : 'That passcode does not match this room.';
          return finish(reject(socket, respond, check.code, message));
        }
      }
    }

    const claimedName = username.value.toLowerCase();
    const accountName = socket.data.account?.username?.toLowerCase() ?? null;

    if (isReservedUsername(claimedName) && claimedName !== accountName) {
      return finish(
        reject(
          socket,
          respond,
          'USERNAME_RESERVED',
          'That name belongs to a registered account. Choose another one.',
        ),
      );
    }

    try {
      const ban =
        socket.data.role === ROLES.ADMIN ? null : await findActiveBan(username.value, room.value);
      if (ban) {
        return finish(
          reject(
            socket,
            respond,
            'BANNED',
            ban.reason ? `You are banned: ${ban.reason}` : 'You are banned from this room.',
          ),
        );
      }
    } catch (error) {
      console.error('[socket] failed to check bans', error);
    }

    if (isNameTakenInRoom(room.value, username.value)) {
      return finish(
        reject(
          socket,
          respond,
          'USERNAME_TAKEN',
          `"${username.value}" is already in #${room.value}. Pick another name.`,
        ),
      );
    }

    socket.join(room.value);
    addUser(socket.id, username.value, room.value, socket.data.role);

    let history = [];
    let hasMore = false;

    if (privateRoom) {
      const page = readMessages(room.value, config.historyLimit);
      history = page.messages;
      hasMore = page.hasMore;
      markOccupied(room.value);
    } else {
      try {
        const page = await getRecentMessages(room.value, config.historyLimit);
        history = page.messages;
        hasMore = page.hasMore;
      } catch (error) {
        console.error('[socket] failed to load history', error);
      }
    }

    const joined = {
      room: room.value,
      username: username.value,
      role: socket.data.role,
      users: getRoomUsers(room.value),
      history,
      hasMore,
      private: Boolean(privateRoom),
      expiresAt: privateRoom ? privateRoom.expiresAt : null,
      passcode: privateRoom ? readPasscode(room.value) : null,
    };

    socket.data.joining = false;
    socket.emit('room:joined', joined);
    respond({ ok: true, ...joined });

    socket.to(room.value).emit('message:new', systemMessage(`${username.value} joined`));
    broadcastUsers(room.value);
  });

  socket.on('message:send', async (payload = {}, ack) => {
    const respond = callable(ack);

    const user = getUser(socket.id);
    if (!user) {
      return reject(socket, respond, 'NOT_IN_ROOM', 'Join a room before sending messages.');
    }

    if (!consumeToken(user.room, user.username)) {
      return reject(socket, respond, 'RATE_LIMITED', 'You are sending messages too quickly.');
    }

    const encrypted = isPrivateName(user.room);
    const text = validateText(payload.text, encrypted ? LIMITS.encrypted.max : LIMITS.text.max);
    if (!text.ok) return reject(socket, respond, text.code, text.message);

    stopTyping();

    if (encrypted) {
      const message = appendMessage(user.room, { username: user.username, text: text.value });
      if (!message) {
        return reject(socket, respond, 'ROOM_EXPIRED', 'That private room has closed.');
      }

      io.to(user.room).emit('message:new', message);

      for (const [, peer] of io.sockets.sockets) {
        if (peer.data.observing !== user.room || !peer.data.observeKey) continue;
        const plain = decryptEnvelope(peer.data.observeKey, message.text);
        if (plain !== null) peer.emit('admin:message', { ...message, text: plain, decrypted: true });
      }

      saveMessage({ room: user.room, username: user.username, text: text.value }).catch((error) =>
        console.error('[socket] failed to record the encrypted message', error),
      );

      return respond({ ok: true, id: message.id, ts: message.ts });
    }

    try {
      const message = await saveMessage({
        room: user.room,
        username: user.username,
        text: text.value,
      });
      io.to(user.room).emit('message:new', message);
      respond({ ok: true, id: message.id, ts: message.ts });
    } catch (error) {
      console.error('[socket] failed to save message', error);
      reject(socket, respond, 'SEND_FAILED', 'Message could not be delivered. Try again.');
    }
  });

  socket.on('messages:load', async (payload = {}, ack) => {
    const respond = callable(ack);

    const user = getUser(socket.id);
    if (!user) {
      return reject(socket, respond, 'NOT_IN_ROOM', 'Join a room before loading history.');
    }

    const requested = Number(payload.limit);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), 200)
      : config.historyLimit;

    if (isPrivateName(user.room)) {
      const page = readMessages(user.room, limit, payload.before ?? null);
      if (page.invalidCursor) {
        return reject(socket, respond, 'CURSOR_INVALID', 'Could not read that history cursor.');
      }
      return respond({ ok: true, messages: page.messages, hasMore: page.hasMore });
    }

    try {
      const page = await getRecentMessages(user.room, limit, payload.before ?? null);
      if (page.invalidCursor) {
        return reject(socket, respond, 'CURSOR_INVALID', 'Could not read that history cursor.');
      }
      respond({ ok: true, messages: page.messages, hasMore: page.hasMore });
    } catch (error) {
      console.error('[socket] failed to load messages', error);
      reject(socket, respond, 'HISTORY_FAILED', 'Could not load older messages.');
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

    if (isPrivateName(user.room) && roomIsEmpty(user.room)) markEmpty(user.room);
  };

  socket.on('room:leave', departRoom);
  socket.on('disconnect', departRoom);
}
