const users = new Map();
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
    if (members.size === 0) rooms.delete(user.room);
  }

  return user;
}

export function getUser(socketId) {
  return users.get(socketId) ?? null;
}

export function getRoomUsers(room) {
  const members = rooms.get(room);
  if (!members) return [];
  return [...members]
    .map((id) => users.get(id)?.username)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function isNameTakenInRoom(room, username) {
  return getRoomUsers(room).some((name) => name.toLowerCase() === username.toLowerCase());
}

export function getActiveRooms() {
  return [...rooms.keys()]
    .map((room) => ({ room, users: getRoomUsers(room).length }))
    .sort((a, b) => b.users - a.users || a.room.localeCompare(b.room));
}

export function getStats() {
  return { connections: users.size, rooms: rooms.size };
}
