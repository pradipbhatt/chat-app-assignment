import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { io as connect } from 'socket.io-client';
import 'dotenv/config';

const PORT = Number(process.env.TEST_ADMIN_PORT) || 5152;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = 'chatapp_admin_test';
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

const ADMIN_USERNAME = 'testadmin';
const ADMIN_PASSWORD = randomBytes(12).toString('base64url');

const testUri = () => {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error('MONGODB_URI is required to run the admin tests.');
  const [scheme, remainder] = raw.split('://');
  const [hostAndPath, query = ''] = remainder.split('?');
  const host = hostAndPath.split('/')[0];
  return `${scheme}://${host}/${TEST_DB}${query ? `?${query}` : ''}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const room = () => `admin-${Math.random().toString(36).slice(2, 8)}`;

let server;
let token;
const sockets = [];

const client = (auth = {}) => {
  const socket = connect(BASE, { autoConnect: false, transports: ['websocket'], auth });
  socket.kicked = null;
  socket.deleted = [];
  socket.cleared = null;
  socket.on('moderation:kicked', (payload) => {
    socket.kicked = payload;
  });
  socket.on('message:deleted', (payload) => socket.deleted.push(payload.id));
  socket.on('room:cleared', (payload) => {
    socket.cleared = payload;
  });
  sockets.push(socket);
  return socket;
};

const join = (socket, username, roomName) =>
  new Promise((resolve) => {
    socket.connect();
    socket.emit('room:join', { username, room: roomName }, resolve);
  });

const emit = (socket, event, payload = {}) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

const api = (path, options = {}) =>
  fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });

before(async () => {
  const uri = testUri();

  server = spawn('node', ['src/server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGODB_URI: uri,
      CLIENT_URL: 'http://localhost:5173',
      ADMIN_USERNAME,
      ADMIN_PASSWORD,
      JWT_SECRET: randomBytes(32).toString('hex'),
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

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  }).then((response) => response.json());

  token = login.token;
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

test('login rejects a wrong password and accepts the seeded admin', async () => {
  const wrong = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: ADMIN_USERNAME, password: 'not-the-password' }),
  });
  assert.equal(wrong.status, 401);
  assert.ok(token);
});

test('admin routes reject missing and forged tokens', async () => {
  assert.equal((await api('/api/admin/overview')).status, 401);
  assert.equal((await api('/api/admin/overview', { token: 'forged.token.value' })).status, 401);
});

test('admin routes accept a valid token', async () => {
  const response = await api('/api/admin/overview', { token });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.users));
});

test('a role claimed in the join payload grants nothing', async () => {
  const impostor = client();
  await join(impostor, 'Impostor', room());
  impostor.emit('room:join', { username: 'Impostor', room: room(), role: 'admin', isAdmin: true });
  await wait(300);

  const attempt = await emit(impostor, 'admin:overview');
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, 'FORBIDDEN');
});

test('an unauthenticated socket cannot use any admin event', async () => {
  const plain = client();
  await join(plain, 'Plain', room());

  for (const event of ['admin:overview', 'admin:kick', 'admin:ban', 'admin:clear-room']) {
    const result = await emit(plain, event, { username: 'Someone', room: 'anywhere' });
    assert.equal(result.code, 'FORBIDDEN', `${event} should be refused`);
  }
});

test('an admin can see live users and kick one', async () => {
  const name = room();
  const victim = client();
  await join(victim, 'Victim', name);
  await wait(300);

  const admin = client({ token });
  await new Promise((resolve) => {
    admin.connect();
    admin.on('connect', resolve);
  });

  const overview = await emit(admin, 'admin:overview');
  assert.ok(overview.users.some((user) => user.username === 'Victim'));

  const kick = await emit(admin, 'admin:kick', { username: 'Victim', reason: 'testing' });
  await wait(500);

  assert.equal(kick.ok, true);
  assert.equal(victim.kicked.reason, 'testing');
  assert.equal(victim.connected, false);
});

test('a banned user cannot rejoin until the ban is lifted', async () => {
  const name = room();
  const admin = client({ token });
  await new Promise((resolve) => {
    admin.connect();
    admin.on('connect', resolve);
  });

  const ban = await emit(admin, 'admin:ban', { username: 'Spammer', room: name, reason: 'spam' });
  assert.equal(ban.ok, true);

  const blocked = await join(client(), 'Spammer', name);
  assert.equal(blocked.code, 'BANNED');

  const lifted = await emit(admin, 'admin:unban', { id: ban.ban.id });
  assert.equal(lifted.ok, true);

  const allowed = await join(client(), 'Spammer', name);
  assert.equal(allowed.ok, true);
});

test('an admin can delete a message and clear a room', async () => {
  const name = room();
  const member = client();
  await join(member, 'Member', name);
  const sent = await emit(member, 'message:send', { text: 'delete me' });
  await emit(member, 'message:send', { text: 'and this' });
  await wait(400);

  const admin = client({ token });
  await new Promise((resolve) => {
    admin.connect();
    admin.on('connect', resolve);
  });

  const removed = await emit(admin, 'admin:delete-message', { id: sent.id });
  await wait(400);
  assert.equal(removed.ok, true);
  assert.ok(member.deleted.includes(sent.id));

  const cleared = await emit(admin, 'admin:clear-room', { room: name });
  await wait(400);
  assert.equal(cleared.ok, true);
  assert.equal(member.cleared.room, name);

  const rejoined = await join(client(), 'Fresh', name);
  assert.equal(rejoined.history.length, 0);
});

test('an anonymous user cannot take a registered account name', async () => {
  const blocked = await join(client(), ADMIN_USERNAME, room());
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'USERNAME_RESERVED');
});

test('the signed-in admin can still join under their own name and is badged', async () => {
  const name = room();
  const admin = client({ token });
  const joined = await join(admin, ADMIN_USERNAME, name);

  assert.equal(joined.ok, true);
  assert.equal(joined.role, 'admin');

  const member = client();
  const view = await join(member, 'Member', name);
  const entry = view.users.find((user) => user.username === ADMIN_USERNAME);
  assert.equal(entry.role, 'admin');
});

test('a signed-in admin may join chat under any free name', async () => {
  const admin = client({ token });
  const attempt = await join(admin, 'NotTheAdmin', room());
  assert.equal(attempt.ok, true);
  assert.equal(attempt.role, 'admin');
});

test('a registered account cannot be kicked or banned, even by an administrator', async () => {
  const name = room();
  const admin = client({ token });
  await join(admin, ADMIN_USERNAME, name);

  const kick = await emit(admin, 'admin:kick', { username: ADMIN_USERNAME });
  assert.equal(kick.ok, false);
  assert.equal(kick.code, 'PROTECTED_ACCOUNT');

  const ban = await emit(admin, 'admin:ban', { username: ADMIN_USERNAME, reason: 'oops' });
  assert.equal(ban.ok, false);
  assert.equal(ban.code, 'PROTECTED_ACCOUNT');

  assert.equal(admin.connected, true);

  const rest = await api('/api/admin/kick', {
    method: 'POST',
    token,
    body: { username: ADMIN_USERNAME },
  });
  assert.equal(rest.status, 400);
});

test('a ban stored against an account name does not lock the administrator out', async () => {
  const name = room();

  await mongoose.connection.collection('bans').insertOne({
    username: ADMIN_USERNAME,
    room: null,
    reason: 'left over',
    createdBy: 'someone',
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const blockedUser = await join(client(), 'Bystander', name);
  assert.equal(blockedUser.ok, true);

  const admin = await join(client({ token }), ADMIN_USERNAME, name);
  assert.equal(admin.ok, true);
  assert.equal(admin.role, 'admin');

  await mongoose.connection.collection('bans').deleteMany({ username: ADMIN_USERNAME });
});

test('the log stream is closed to anyone without an administrator token', async () => {
  const plain = client();
  await join(plain, 'Curious', room());

  const attempt = await emit(plain, 'admin:logs:subscribe');
  assert.equal(attempt.ok, false);
  assert.equal(attempt.code, 'FORBIDDEN');

  assert.equal((await api('/api/admin/logs')).status, 401);
  assert.equal((await api('/api/admin/logs', { token: 'forged.token.value' })).status, 401);
});

test('an administrator receives the log tail and server status', async () => {
  const admin = client({ token });
  await new Promise((resolve) => {
    admin.connect();
    admin.on('connect', resolve);
  });

  const response = await emit(admin, 'admin:logs:subscribe', { limit: 50 });
  assert.equal(response.ok, true);
  assert.ok(Array.isArray(response.entries));
  assert.equal(typeof response.status.uptime, 'number');
  assert.ok(['connected', 'connecting', 'disconnected', 'disconnecting'].includes(response.status.database));

  const stopped = await emit(admin, 'admin:logs:unsubscribe');
  assert.equal(stopped.ok, true);
});

test('login is rate limited after repeated failures', async () => {
  let sawLimit = false;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: ADMIN_USERNAME, password: `guess-${attempt}` }),
    });
    if (response.status === 429) {
      sawLimit = true;
      break;
    }
  }
  assert.equal(sawLimit, true);
});
