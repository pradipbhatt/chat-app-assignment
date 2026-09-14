import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPasscode,
  readPasscode,
  createPrivateRoom,
  getPrivateRoom,
  isPrivateName,
  markEmpty,
  markOccupied,
  appendMessage,
  readMessages,
  removeMessage,
  clearMessages,
  listPrivateRooms,
  sweep,
  resetPrivateRooms,
  PRIVATE_PREFIX,
} from '../src/socket/privateRooms.js';
import { config } from '../src/config/env.js';

const HOUR = 60 * 60 * 1000;
const LIFETIME = config.privateRoom.lifetimeHours * HOUR;
const GRACE = config.privateRoom.graceHours * HOUR;

beforeEach(() => resetPrivateRooms());

test('a created room carries the private prefix and enough entropy', () => {
  const { slug } = createPrivateRoom('Maker');
  assert.ok(slug.startsWith(PRIVATE_PREFIX));
  assert.ok(isPrivateName(slug));
  assert.ok(slug.length > 20);
});

test('two rooms never share a slug', () => {
  const slugs = new Set();
  for (let i = 0; i < 200; i += 1) slugs.add(createPrivateRoom('Maker').slug);
  assert.equal(slugs.size, 200);
});

test('an unknown slug resolves to nothing', () => {
  assert.equal(getPrivateRoom('p-made-up-000000000000'), null);
});

test('messages live in memory and page back through a cursor', () => {
  const { slug } = createPrivateRoom('Maker');
  for (let i = 1; i <= 5; i += 1) appendMessage(slug, { username: 'A', text: `line ${i}` });

  const recent = readMessages(slug, 2);
  assert.equal(recent.messages.length, 2);
  assert.equal(recent.hasMore, true);
  assert.equal(recent.messages.at(-1).text, 'line 5');

  const older = readMessages(slug, 2, recent.messages[0].ts);
  assert.ok(older.messages.every((message) => message.ts < recent.messages[0].ts));

  assert.equal(readMessages(slug, 5, 'not-a-number').invalidCursor, true);
});

test('an administrator can remove one message or clear the room', () => {
  const { slug } = createPrivateRoom('Maker');
  const first = appendMessage(slug, { username: 'A', text: 'one' });
  appendMessage(slug, { username: 'A', text: 'two' });

  assert.equal(removeMessage(slug, first.id), true);
  assert.equal(removeMessage(slug, first.id), false);
  assert.equal(readMessages(slug, 10).messages.length, 1);

  assert.equal(clearMessages(slug), 1);
  assert.equal(readMessages(slug, 10).messages.length, 0);
});

test('a room left empty is cleared once the grace period passes', () => {
  const { slug } = createPrivateRoom('Maker');
  markEmpty(slug);

  assert.deepEqual(sweep(Date.now() + GRACE / 2), []);
  assert.ok(getPrivateRoom(slug));

  assert.deepEqual(sweep(Date.now() + GRACE + HOUR), [slug]);
  assert.equal(getPrivateRoom(slug), null);
});

test('someone rejoining before the grace period keeps the room alive', () => {
  const { slug } = createPrivateRoom('Maker');
  markEmpty(slug);
  markOccupied(slug);

  assert.deepEqual(sweep(Date.now() + GRACE / 2), []);
  assert.ok(getPrivateRoom(slug));
});

test('an occupied room still closes once its lifetime is up', () => {
  const { slug } = createPrivateRoom('Maker');
  markOccupied(slug);

  assert.deepEqual(sweep(Date.now() + LIFETIME / 2), []);
  assert.deepEqual(sweep(Date.now() + LIFETIME + HOUR), [slug]);
  assert.equal(getPrivateRoom(slug), null);
});

test('an expired room reports as gone rather than being recreated', () => {
  const { slug } = createPrivateRoom('Maker');
  sweep(Date.now() + LIFETIME + HOUR);

  assert.equal(getPrivateRoom(slug), null);
  assert.equal(appendMessage(slug, { username: 'A', text: 'late' }), null);
  assert.equal(listPrivateRooms().length, 0);
});

test('the buffer is capped so a long session cannot grow without bound', () => {
  const { slug } = createPrivateRoom('Maker');
  for (let i = 0; i < 260; i += 1) appendMessage(slug, { username: 'A', text: `m${i}` });

  const all = readMessages(slug, 1000);
  assert.equal(all.messages.length, 200);
  assert.equal(all.messages.at(-1).text, 'm259');
});

test('a created room carries a six character passcode without ambiguous letters', () => {
  const { slug, passcode } = createPrivateRoom('Maker');
  assert.equal(passcode.length, 6);
  assert.ok(!/[IO01]/.test(passcode));
  assert.equal(readPasscode(slug), passcode);
});

test('passcodes differ between rooms', () => {
  const codes = new Set();
  for (let i = 0; i < 100; i += 1) codes.add(createPrivateRoom('Maker').passcode);
  assert.ok(codes.size > 90);
});

test('the passcode is checked case insensitively and ignores padding', () => {
  const { slug, passcode } = createPrivateRoom('Maker');
  assert.equal(verifyPasscode(slug, passcode).ok, true);
  assert.equal(verifyPasscode(slug, `  ${passcode.toLowerCase()}  `.trim().toUpperCase()).ok, true);
});

test('a wrong passcode is refused and repeated guesses are throttled', () => {
  const { slug } = createPrivateRoom('Maker');

  for (let i = 0; i < 6; i += 1) {
    assert.equal(verifyPasscode(slug, 'AAAAAA', 'guesser').code, 'PASSCODE_INVALID');
  }

  assert.equal(verifyPasscode(slug, 'AAAAAA', 'guesser').code, 'PASSCODE_THROTTLED');
});

test('throttling is per guesser, not per room', () => {
  const { slug, passcode } = createPrivateRoom('Maker');
  for (let i = 0; i < 7; i += 1) verifyPasscode(slug, 'AAAAAA', 'guesser');

  assert.equal(verifyPasscode(slug, passcode, 'someone-else').ok, true);
});

test('a correct passcode clears that guesser\'s failed attempts', () => {
  const { slug, passcode } = createPrivateRoom('Maker');
  verifyPasscode(slug, 'AAAAAA', 'person');
  verifyPasscode(slug, 'AAAAAA', 'person');
  assert.equal(verifyPasscode(slug, passcode, 'person').ok, true);

  for (let i = 0; i < 6; i += 1) {
    assert.equal(verifyPasscode(slug, 'AAAAAA', 'person').code, 'PASSCODE_INVALID');
  }
});

test('an expired room refuses any passcode', () => {
  const { slug, passcode } = createPrivateRoom('Maker');
  sweep(Date.now() + LIFETIME + HOUR);
  assert.equal(verifyPasscode(slug, passcode).code, 'ROOM_EXPIRED');
  assert.equal(readPasscode(slug), null);
});
