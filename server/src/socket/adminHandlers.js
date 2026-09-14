import { ROLES } from '../models/User.js';
import { listEntries, subscribe } from '../utils/logBuffer.js';
import { getRoomUsers } from './rooms.js';
import { isPrivateName, readMessages, getPrivateRoom } from './privateRooms.js';
import { getRecentMessages } from '../models/Message.js';
import { readRoomKey } from '../models/RoomKey.js';
import { unwrapRoomKey as serverUnwrap, decryptEnvelope } from '../utils/escrowServer.js';
import { validateRoom } from '../utils/validate.js';
import { serverStatus } from '../routes/logs.js';
import {
  overview,
  kickUser,
  banUser,
  unbanUser,
  bans,
  deleteMessage,
  clearRoom,
} from '../services/moderation.js';

const callable = (fn) => (typeof fn === 'function' ? fn : () => {});

const DENIED = {
  ok: false,
  code: 'FORBIDDEN',
  message: 'Administrator access is required for this action.',
};

const LOG_ROOM = 'admin:logs';

export function registerAdminHandlers(io, socket) {
  let unsubscribe = null;
  let statusTimer = null;

  const stopObserving = () => {
    if (socket.data.observing) {
      socket.leave(socket.data.observing);
      socket.data.observing = null;
      socket.data.observeKey = null;
    }
  };

  const stopStreaming = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }
    socket.leave(LOG_ROOM);
  };

  const guard = (handler) => async (payload = {}, ack) => {
    const respond = callable(ack);

    if (socket.data.role !== ROLES.ADMIN || !socket.data.account) {
      socket.emit('error:app', DENIED);
      return respond(DENIED);
    }

    try {
      return respond(await handler(payload, socket.data.account));
    } catch (error) {
      console.error('[admin] socket action failed', error);
      return respond({ ok: false, code: 'ACTION_FAILED', message: 'That action could not be completed.' });
    }
  };

  socket.on('admin:overview', guard(async () => ({ ok: true, ...overview() })));

  socket.on(
    'admin:logs:subscribe',
    guard(async (payload) => {
      stopStreaming();
      socket.join(LOG_ROOM);

      const requested = Number(payload.limit);
      const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 400) : 120;

      unsubscribe = subscribe((entry) => socket.emit('admin:log', entry));
      statusTimer = setInterval(() => socket.emit('admin:status', serverStatus()), 5000);
      statusTimer.unref();

      return { ok: true, status: serverStatus(), entries: listEntries(limit) };
    }),
  );

  socket.on(
    'admin:logs:unsubscribe',
    guard(async () => {
      stopStreaming();
      return { ok: true };
    }),
  );

  socket.on(
    'admin:observe',
    guard(async (payload) => {
      const room = validateRoom(payload.room);
      if (!room.ok) return { ok: false, code: room.code, message: room.message };

      stopObserving();

      const isPrivate = isPrivateName(room.value);
      if (isPrivate && !getPrivateRoom(room.value)) {
        return { ok: false, code: 'ROOM_EXPIRED', message: 'That private room has closed.' };
      }

      socket.join(room.value);
      socket.data.observing = room.value;

      const page = isPrivate
        ? readMessages(room.value, 200)
        : await getRecentMessages(room.value, 200);

      let messages = page.messages;
      let readable = true;

      if (isPrivate) {
        const roomKey = await serverUnwrap(await readRoomKey(room.value));
        socket.data.observeKey = roomKey;
        readable = Boolean(roomKey);

        if (roomKey) {
          messages = messages.map((message) => {
            const plain = decryptEnvelope(roomKey, message.text);
            return plain === null ? message : { ...message, text: plain, decrypted: true };
          });
        }
      } else {
        socket.data.observeKey = null;
      }

      return {
        ok: true,
        room: room.value,
        private: isPrivate,
        readable,
        users: getRoomUsers(room.value),
        messages,
        hasMore: page.hasMore,
      };
    }),
  );

  socket.on(
    'admin:unobserve',
    guard(async () => {
      stopObserving();
      return { ok: true };
    }),
  );

  socket.on('disconnect', () => {
    stopStreaming();
    stopObserving();
  });

  socket.on(
    'admin:kick',
    guard((payload, account) =>
      kickUser({
        username: payload.username,
        room: payload.room,
        reason: payload.reason,
        actor: account.username,
      }),
    ),
  );

  socket.on(
    'admin:ban',
    guard((payload, account) =>
      banUser({
        username: payload.username,
        room: payload.room,
        reason: payload.reason,
        minutes: Number(payload.minutes) || null,
        actor: account.username,
      }),
    ),
  );

  socket.on('admin:unban', guard((payload) => unbanUser(payload.id)));

  socket.on('admin:bans', guard(() => bans()));

  socket.on(
    'admin:delete-message',
    guard((payload, account) =>
      deleteMessage({ id: payload.id, room: payload.room ?? null, actor: account.username }),
    ),
  );

  socket.on(
    'admin:clear-room',
    guard((payload, account) => clearRoom({ room: payload.room, actor: account.username })),
  );
}
