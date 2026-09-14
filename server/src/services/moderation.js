import { Message } from '../models/Message.js';
import { createBan, removeBan, listBans } from '../models/Ban.js';
import { getIo } from '../socket/ioRef.js';
import { findSocketIds, getAllUsers, getActiveRooms, getRoomUsers } from '../socket/rooms.js';
import { validateRoom, validateUsername } from '../utils/validate.js';

const notFound = (message) => ({ ok: false, code: 'NOT_FOUND', message });
const invalid = (code, message) => ({ ok: false, code, message });

export function overview() {
  const users = getAllUsers();
  const rooms = getActiveRooms();
  return {
    rooms,
    users: users.map(({ username, room, role }) => ({ username, room, role })),
    totals: { users: users.length, rooms: rooms.length },
  };
}

export async function kickUser({ username, room, actor, reason = '' }) {
  const name = validateUsername(username);
  if (!name.ok) return invalid(name.code, name.message);

  const io = getIo();
  if (!io) return invalid('UNAVAILABLE', 'Realtime server is not ready.');

  const targets = findSocketIds(name.value, room || null);
  if (targets.length === 0) return notFound('That user is not connected.');

  for (const socketId of targets) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    socket.emit('moderation:kicked', { reason, by: actor });
    socket.disconnect(true);
  }

  return { ok: true, kicked: targets.length };
}

export async function banUser({ username, room, actor, reason = '', minutes = null }) {
  const name = validateUsername(username);
  if (!name.ok) return invalid(name.code, name.message);

  let scope = null;
  if (room) {
    const validated = validateRoom(room);
    if (!validated.ok) return invalid(validated.code, validated.message);
    scope = validated.value;
  }

  const ban = await createBan({
    username: name.value,
    room: scope,
    reason,
    createdBy: actor,
    minutes,
  });

  await kickUser({ username: name.value, room: scope, actor, reason: reason || 'Banned' });

  return { ok: true, ban };
}

export async function unbanUser(id) {
  const removed = await removeBan(id);
  if (!removed) return notFound('That ban no longer exists.');
  return { ok: true };
}

export async function bans() {
  return { ok: true, bans: await listBans() };
}

export async function deleteMessage({ id, actor }) {
  const message = await Message.findById(id).exec();
  if (!message) return notFound('That message no longer exists.');

  const room = message.room;
  await message.deleteOne();

  const io = getIo();
  if (io) io.to(room).emit('message:deleted', { id, by: actor });

  return { ok: true, id, room };
}

export async function clearRoom({ room, actor }) {
  const validated = validateRoom(room);
  if (!validated.ok) return invalid(validated.code, validated.message);

  const result = await Message.deleteMany({ room: validated.value }).exec();

  const io = getIo();
  if (io) io.to(validated.value).emit('room:cleared', { room: validated.value, by: actor });

  return { ok: true, room: validated.value, deleted: result.deletedCount ?? 0 };
}

export function roomMembers(room) {
  return { ok: true, room, users: getRoomUsers(room) };
}
