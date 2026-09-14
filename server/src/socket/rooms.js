const users = new Map();
const rooms = new Map();

export function addUser(socketId, username, room, role = 'user') {
  users.set(socketId, { username, room, role });
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
    .map((id) => users.get(id))
    .filter(Boolean)
    .map((user) => ({ username: user.username, role: user.role }))
    .sort((a, b) => a.username.localeCompare(b.username));
}

export function isNameTakenInRoom(room, username) {
  const wanted = username.toLowerCase();
  return getRoomUsers(room).some((user) => user.username.toLowerCase() === wanted);
}

export function getAllUsers() {
  return [...users.entries()]
    .map(([socketId, user]) => ({
      socketId,
      username: user.username,
      room: user.room,
      role: user.role,
    }))
    .sort((a, b) => a.room.localeCompare(b.room) || a.username.localeCompare(b.username));
}

export function findSocketIds(username, room = null) {
  const wanted = username.toLowerCase();
  return [...users.entries()]
    .filter(([, user]) => user.username.toLowerCase() === wanted && (!room || user.room === room))
    .map(([socketId]) => socketId);
}

export function getActiveRooms() {
  return [...rooms.keys()]
    .map((room) => ({ room, users: getRoomUsers(room).length }))
    .sort((a, b) => b.users - a.users || a.room.localeCompare(b.room));
}

export function getStats() {
  return { connections: users.size, rooms: rooms.size };
}
