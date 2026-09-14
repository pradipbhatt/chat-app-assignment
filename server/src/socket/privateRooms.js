import { randomUUID, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';

export const PRIVATE_PREFIX = 'p-';

const LIFETIME_MS = config.privateRoom.lifetimeHours * 60 * 60 * 1000;
const EMPTY_GRACE_MS = config.privateRoom.graceHours * 60 * 60 * 1000;
const MAX_BUFFERED = 200;
const SWEEP_INTERVAL_MS = 60 * 1000;

const ADJECTIVES = ['amber', 'brave', 'calm', 'coral', 'eager', 'hazel', 'jolly', 'mellow', 'olive', 'sage', 'teal', 'vivid'];
const NOUNS = ['otter', 'falcon', 'maple', 'lantern', 'meadow', 'comet', 'willow', 'ember', 'anchor', 'quartz', 'beacon', 'summit'];

const rooms = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function isPrivateName(room) {
  return typeof room === 'string' && room.startsWith(PRIVATE_PREFIX);
}

export function createPrivateRoom(createdBy) {
  const now = Date.now();
  let slug = '';

  do {
    slug = `${PRIVATE_PREFIX}${pick(ADJECTIVES)}-${pick(NOUNS)}-${randomBytes(6).toString('hex')}`;
  } while (rooms.has(slug));

  rooms.set(slug, {
    createdBy,
    createdAt: now,
    expiresAt: now + LIFETIME_MS,
    emptySince: now,
    messages: [],
  });

  return { slug, expiresAt: now + LIFETIME_MS };
}

export function getPrivateRoom(slug) {
  const room = rooms.get(slug);
  if (!room) return null;
  if (Date.now() > room.expiresAt) {
    rooms.delete(slug);
    return null;
  }
  return room;
}

export function markOccupied(slug) {
  const room = rooms.get(slug);
  if (room) room.emptySince = null;
}

export function markEmpty(slug) {
  const room = rooms.get(slug);
  if (room) room.emptySince = Date.now();
}

export function appendMessage(slug, { username, text }) {
  const room = getPrivateRoom(slug);
  if (!room) return null;

  const message = {
    id: randomUUID(),
    username,
    text,
    ts: Date.now(),
    system: false,
  };

  room.messages.push(message);
  if (room.messages.length > MAX_BUFFERED) room.messages.splice(0, room.messages.length - MAX_BUFFERED);

  return message;
}

export function readMessages(slug, limit, before = null) {
  const room = getPrivateRoom(slug);
  if (!room) return { messages: [], hasMore: false, invalidCursor: false };

  let pool = room.messages;

  if (before !== null && before !== undefined && before !== '') {
    const cutoff = Number(before);
    if (!Number.isFinite(cutoff)) return { messages: [], hasMore: false, invalidCursor: true };
    pool = pool.filter((message) => message.ts < cutoff);
  }

  const slice = pool.slice(Math.max(0, pool.length - limit));
  return { messages: slice, hasMore: pool.length > slice.length, invalidCursor: false };
}

export function removeMessage(slug, id) {
  const room = getPrivateRoom(slug);
  if (!room) return false;

  const index = room.messages.findIndex((message) => message.id === id);
  if (index === -1) return false;

  room.messages.splice(index, 1);
  return true;
}

export function clearMessages(slug) {
  const room = getPrivateRoom(slug);
  if (!room) return 0;

  const removed = room.messages.length;
  room.messages = [];
  return removed;
}

export function listPrivateRooms() {
  return [...rooms.entries()].map(([slug, room]) => ({
    room: slug,
    createdBy: room.createdBy,
    expiresAt: room.expiresAt,
    buffered: room.messages.length,
  }));
}

export function sweep(now = Date.now()) {
  const expired = [];

  for (const [slug, room] of rooms) {
    const pastLifetime = now > room.expiresAt;
    const abandoned = room.emptySince !== null && now - room.emptySince > EMPTY_GRACE_MS;
    if (pastLifetime || abandoned) {
      rooms.delete(slug);
      expired.push(slug);
    }
  }

  return expired;
}

export function startSweeper() {
  const timer = setInterval(() => {
    const removed = sweep();
    if (removed.length > 0) console.log(`[private] cleared ${removed.length} inactive room(s)`);
  }, SWEEP_INTERVAL_MS);

  timer.unref();
  return timer;
}

export function resetPrivateRooms() {
  rooms.clear();
}
