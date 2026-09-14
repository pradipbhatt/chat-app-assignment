/**
 * In-memory registry of who is connected and where.
 *
 * Socket.IO already tracks room membership internally; this exists so a roster
 * can be built without reaching into adapter internals, and so a socket id can
 * be resolved back to a username on disconnect (by then the socket has already
 * left its rooms).
 *
 * Deliberately not persisted: message history and sessions are out of scope for
 * this task. Consequences, stated rather than discovered later: everything is
 * lost on restart, and a second server process would not share this state —
 * horizontal scaling would need the Socket.IO Redis adapter.
 */

/** @type {Map<string, { username: string, room: string }>} socketId -> identity */
const users = new Map();

/** @type {Map<string, Set<string>>} room -> set of socketIds */
const rooms = new Map();

export function addUser(socketId, username, room) {
  users.set(socketId, { username, room });
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(socketId);
}

export function removeUser(socketId) {
  const user = users.get(socketId);
  if (!user) return null;

  users.delete(socketId);

  const members = rooms.get(user.room);
  if (members) {
    members.delete(socketId);
    // Drop empty rooms so the map does not grow without bound over a long
    // uptime as people come and go through one-off room names.
    if (members.size === 0) rooms.delete(user.room);
  }

  return user;
}

export function getUser(socketId) {
  return users.get(socketId) ?? null;
}

/** Usernames in a room, sorted so every client renders the roster identically. */
export function getRoomUsers(room) {
  const members = rooms.get(room);
  if (!members) return [];
  return [...members]
    .map((id) => users.get(id)?.username)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

/** True when this room already contains someone using this exact name. */
export function isNameTakenInRoom(room, username) {
  return getRoomUsers(room).some((name) => name.toLowerCase() === username.toLowerCase());
}

export function getStats() {
  return { connections: users.size, rooms: rooms.size };
}
