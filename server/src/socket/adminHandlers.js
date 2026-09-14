import { ROLES } from '../models/User.js';
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

export function registerAdminHandlers(io, socket) {
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
