import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';
import 'dotenv/config';

const PORT = Number(process.env.TEST_PORT) || 5151;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = 'chatapp_test';
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

const testUri = () => {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error('MONGODB_URI is required to run the server tests.');
  const [scheme, remainder] = raw.split('://');
  const [hostAndPath, query = ''] = remainder.split('?');
  const host = hostAndPath.split('/')[0];
  return `${scheme}://${host}/${TEST_DB}${query ? `?${query}` : ''}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const room = () => `test-${Math.random().toString(36).slice(2, 8)}`;

let server;
const sockets = [];

const client = () => {
  const socket = connect(BASE, { autoConnect: false, transports: ['websocket'] });
  socket.inbox = [];
  socket.errors = [];
  socket.roster = [];
  socket.typing = null;
  socket.on('message:new', (message) => socket.inbox.push(message));
  socket.on('error:app', (error) => socket.errors.push(error.code));
  socket.on('room:users', (payload) => {
    socket.roster = payload.users;
  });
  socket.on('typing:start', (payload) => {
    socket.typing = payload.username;
  });
  sockets.push(socket);
  return socket;
};

const join = (socket, username, roomName) =>
  new Promise((resolve) => {
    socket.connect();
    socket.emit('room:join', { username, room: roomName }, resolve);
  });

const send = (socket, text) =>
  new Promise((resolve) => socket.emit('message:send', { text }, resolve));

before(async () => {
  const uri = testUri();

  server = spawn('node', ['src/server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGODB_URI: uri,
      CLIENT_URL: 'http://localhost:5173',
      RATE_LIMIT_REFILL_PER_SECOND: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) break;
    } catch {
      await wait(400);
    }
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (server) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
});

test('health reports an ok status and a connected database', async () => {
  const body = await fetch(`${BASE}/health`).then((response) => response.json());
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'connected');
});

test('unknown routes return 404', async () => {
  const response = await fetch(`${BASE}/does-not-exist`);
  assert.equal(response.status, 404);
});

test('a client connects over websocket and receives a join acknowledgement', async () => {
  const socket = client();
  const ack = await join(socket, 'Pradip', room());
  assert.equal(ack.ok, true);
  assert.equal(socket.io.engine.transport.name, 'websocket');
});

test('messages reach other clients in the same room and the sender', async () => {
  const name = room();
  const a = client();
  const b = client();
  await join(a, 'Pradip', name);
  await join(b, 'Alice', name);

  const ack = await send(a, 'hello');
  await wait(400);

  assert.equal(ack.ok, true);
  assert.ok(ack.id);
  assert.ok(b.inbox.some((message) => message.text === 'hello'));
  assert.ok(a.inbox.some((message) => message.text === 'hello'));
});

test('messages do not leak into other rooms', async () => {
  const a = client();
  const outsider = client();
  await join(a, 'Pradip', room());
  await join(outsider, 'Eve', room());

  await send(a, 'private');
  await wait(400);

  assert.ok(!outsider.inbox.some((message) => message.text === 'private'));
});

test('the roster updates on join and on disconnect', async () => {
  const name = room();
  const a = client();
  const b = client();
  await join(a, 'Pradip', name);
  await join(b, 'Alice', name);
  await wait(300);
  assert.deepEqual(
    a.roster.map((user) => user.username),
    ['Alice', 'Pradip'],
  );
  assert.ok(a.roster.every((user) => user.role === 'user'));

  b.disconnect();
  await wait(500);
  assert.deepEqual(
    a.roster.map((user) => user.username),
    ['Pradip'],
  );
  assert.ok(a.inbox.some((message) => message.system && message.text.includes('Alice left')));
});

test('typing indicators reach peers', async () => {
  const name = room();
  const a = client();
  const b = client();
  await join(a, 'Pradip', name);
  await join(b, 'Alice', name);

  b.emit('typing:start');
  await wait(300);

  assert.equal(a.typing, 'Alice');
});

test('invalid input is rejected through the acknowledgement', async () => {
  const name = room();
  const a = client();
  await join(a, 'Pradip', name);

  const empty = await send(a, '   ');
  assert.equal(empty.ok, false);
  assert.equal(empty.code, 'MESSAGE_EMPTY');

  const duplicate = await join(client(), 'Pradip', name);
  assert.equal(duplicate.code, 'USERNAME_TAKEN');

  const badRoom = await join(client(), 'Someone', 'bad room!');
  assert.equal(badRoom.code, 'ROOM_CHARSET');
});

test('the rate limit refuses a burst and is not reset by reconnecting', async () => {
  const name = room();
  const a = client();
  await join(a, 'Flood', name);

  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => send(a, `flood ${i}`)));
  const refused = results.filter((result) => result.code === 'RATE_LIMITED');
  assert.ok(refused.length > 0);

  a.disconnect();
  await wait(300);
  const rejoined = client();
  await join(rejoined, 'Flood', name);
  const afterReconnect = await send(rejoined, 'still limited');
  assert.equal(afterReconnect.code, 'RATE_LIMITED');
});

test('message text is stored verbatim', async () => {
  const name = room();
  const a = client();
  const b = client();
  await join(a, 'Pradip', name);
  await join(b, 'Alice', name);

  const payload = '<img src=x onerror=alert(1)>';
  await send(a, payload);
  await wait(400);

  assert.ok(b.inbox.some((message) => message.text === payload));
});

test('history is replayed to a late joiner without system notices', async () => {
  const name = room();
  const a = client();
  await join(a, 'Pradip', name);
  await send(a, 'first');
  await send(a, 'second');
  await wait(400);

  const late = await join(client(), 'Latecomer', name);
  assert.equal(late.history.length, 2);
  assert.ok(!late.history.some((message) => message.system));
  assert.deepEqual(
    late.history.map((message) => message.text),
    ['first', 'second'],
  );
});

test('older messages page through the before cursor', async () => {
  const name = room();
  const a = client();
  await join(a, 'Pradip', name);
  for (const text of ['one', 'two', 'three']) await send(a, text);
  await wait(500);

  const page = await new Promise((resolve) => a.emit('messages:load', { limit: 2 }, resolve));
  assert.equal(page.messages.length, 2);
  assert.equal(page.hasMore, true);

  const older = await new Promise((resolve) =>
    a.emit('messages:load', { limit: 2, before: page.messages[0].ts }, resolve),
  );
  assert.equal(older.messages.at(-1).text, 'one');
});

test('the rooms endpoint lists active rooms with occupancy', async () => {
  const name = room();
  const a = client();
  await join(a, 'Pradip', name);
  await wait(300);

  const body = await fetch(`${BASE}/api/rooms`).then((response) => response.json());
  const entry = body.rooms.find((item) => item.room === name);
  assert.ok(entry);
  assert.equal(entry.users, 1);
});

test('the rest history endpoint validates the room and the cursor', async () => {
  const name = room();
  const a = client();
  await join(a, 'Pradip', name);
  await send(a, 'stored');
  await wait(400);

  const ok = await fetch(`${BASE}/api/rooms/${name}/messages?limit=5`).then((r) => r.json());
  assert.equal(ok.messages.length, 1);

  const badRoom = await fetch(`${BASE}/api/rooms/bad room!/messages`);
  assert.equal(badRoom.status, 400);

  const badCursor = await fetch(`${BASE}/api/rooms/${name}/messages?before=notadate`);
  assert.equal(badCursor.status, 400);
});

test('the server shuts down while a client is still connected', async () => {
  const socket = client();
  await join(socket, 'Holder', room());

  const exited = once(server, 'exit');
  server.kill('SIGTERM');

  const result = await Promise.race([
    exited.then(() => 'exited'),
    wait(8000).then(() => 'hung'),
  ]);

  assert.equal(result, 'exited');
  server = null;
});
