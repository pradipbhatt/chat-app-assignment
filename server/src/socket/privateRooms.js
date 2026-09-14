import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';

export const PRIVATE_PREFIX = 'p-';

const LIFETIME_MS = 4 * 60 * 60 * 1000;
const EMPTY_GRACE_MS = 10 * 60 * 1000;
const MAX_BUFFERED = 200;
const SWEEP_INTERVAL_MS = 60 * 1000;
const PASSCODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PASSCODE_LENGTH = 6;
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

const ADJECTIVES = ['amber', 'brave', 'calm', 'coral', 'eager', 'hazel', 'jolly', 'mellow', 'olive', 'sage', 'teal', 'vivid'];
const NOUNS = ['otter', 'falcon', 'maple', 'lantern', 'meadow', 'comet', 'willow', 'ember', 'anchor', 'quartz', 'beacon', 'summit'];

const rooms = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function makePasscode() {
  const bytes = randomBytes(PASSCODE_LENGTH);
  let code = '';
  for (let index = 0; index < PASSCODE_LENGTH; index += 1) {
    code += PASSCODE_ALPHABET[bytes[index] % PASSCODE_ALPHABET.length];
  }
  return code;
}

function sameCode(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isPrivateName(room) {
  return typeof room === 'string' && room.startsWith(PRIVATE_PREFIX);
}

export function createPrivateRoom(createdBy) {
  const now = Date.now();
  let slug = '';

  do {
    slug = `${PRIVATE_PREFIX}${pick(ADJECTIVES)}-${pick(NOUNS)}-${randomBytes(6).toString('hex')}`;
  } while (rooms.has(slug));

  const passcode = makePasscode();

  rooms.set(slug, {
    createdBy,
    createdAt: now,
    expiresAt: now + LIFETIME_MS,
    emptySince: now,
    passcode,
    attempts: new Map(),
    messages: [],
  });

  return { slug, passcode, expiresAt: now + LIFETIME_MS };
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

export function verifyPasscode(slug, candidate, attemptKey = 'anonymous') {
  const room = getPrivateRoom(slug);
  if (!room) return { ok: false, code: 'ROOM_EXPIRED' };

  const now = Date.now();
  const record = room.attempts.get(attemptKey);

  if (record && now - record.first < ATTEMPT_WINDOW_MS && record.count >= MAX_ATTEMPTS) {
    return { ok: false, code: 'PASSCODE_THROTTLED' };
  }

  if (typeof candidate !== 'string' || !sameCode(room.passcode, candidate.trim().toUpperCase())) {
    if (!record || now - record.first >= ATTEMPT_WINDOW_MS) {
      room.attempts.set(attemptKey, { count: 1, first: now });
    } else {
      record.count += 1;
    }
    return { ok: false, code: 'PASSCODE_INVALID' };
  }

  room.attempts.delete(attemptKey);
  return { ok: true, passcode: room.passcode };
}

export function readPasscode(slug) {
  const room = getPrivateRoom(slug);
  return room ? room.passcode : null;
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
