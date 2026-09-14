import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomBytes, createPublicKey, publicEncrypt, createCipheriv, constants } from 'node:crypto';
import mongoose from 'mongoose';
import 'dotenv/config';

const PORT = Number(process.env.TEST_ESCROW_PORT) || 5154;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = 'chatapp_escrow_test';
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

const ADMIN_USERNAME = 'escrowadmin';
const ADMIN_PASSWORD = randomBytes(12).toString('base64url');

const testUri = () => {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error('MONGODB_URI is required to run the escrow tests.');
  const [scheme, remainder] = raw.split('://');
  const [hostAndPath, query = ''] = remainder.split('?');
  const host = hostAndPath.split('/')[0];
  return `${scheme}://${host}/${TEST_DB}${query ? `?${query}` : ''}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toBase64Url = (buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let server;
let token;

const api = (path, options = {}) =>
  fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

async function sealForRoom(room, plaintext) {
  const { escrow } = await api('/api/escrow/public-key').then((response) => response.json());
  const publicKey = createPublicKey({ key: escrow.publicKeyJwk, format: 'jwk' });

  const roomKey = randomBytes(32);
  const wrappedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    roomKey,
  ).toString('base64');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', roomKey, iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const text = `e2e.v1.${toBase64Url(iv)}.${toBase64Url(Buffer.concat([body, cipher.getAuthTag()]))}`;

  await mongoose.connection.collection('roomkeys').insertOne({
    room,
    wrappedKey,
    createdBy: 'Someone',
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await mongoose.connection.collection('messages').insertOne({
    room,
    username: 'Someone',
    text,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { text };
}

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
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  }).then((response) => response.json());

  token = login.token;
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (server) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
});

test('the server creates its own review key on boot', async () => {
  const body = await api('/api/escrow/public-key').then((response) => response.json());
  assert.equal(body.escrow.publicKeyJwk.kty, 'RSA');
  assert.equal(body.escrow.publicKeyJwk.alg, 'RSA-OAEP-256');
});

test('the sealed private key is never served over http', async () => {
  const body = await api('/api/escrow/public-key').then((response) => response.text());
  assert.ok(!body.includes('wrappedPrivateKey'));
  assert.ok(!body.includes('"d"'));

  assert.equal((await api('/api/escrow/vault')).status, 404);
  assert.equal((await api('/api/escrow/vault', { method: 'POST', token, body: {} })).status, 404);
});

test('the private key is stored sealed, not in the clear', async () => {
  const record = await mongoose.connection.collection('escrows').findOne({});
  assert.equal(record.sealedBy, 'server');
  assert.ok(!record.wrappedPrivateKey.includes('PRIVATE KEY'));
});

test('private room review is closed to anyone without an administrator token', async () => {
  assert.equal((await api('/api/admin/private-rooms')).status, 401);
  assert.equal((await api('/api/admin/private-rooms/p-room-abc')).status, 401);
});

test('an administrator reads a stored room as plaintext', async () => {
  const room = 'p-test-room-abcdef123456';
  const { text } = await sealForRoom(room, 'the safe combination is 1234');

  const body = await api(`/api/admin/private-rooms/${room}`, { token }).then((r) => r.json());

  assert.equal(body.readable, true);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].text, 'the safe combination is 1234');
  assert.equal(body.messages[0].decrypted, true);
  assert.ok(text.startsWith('e2e.v1.'));

  const stored = await mongoose.connection.collection('messages').findOne({ room });
  assert.ok(stored.text.startsWith('e2e.v1.'), 'the database still holds ciphertext');
});

test('a room whose key cannot be opened stays sealed rather than erroring', async () => {
  const room = 'p-foreign-key-abcdef123456';

  await mongoose.connection.collection('roomkeys').insertOne({
    room,
    wrappedKey: Buffer.from('not a real wrapped key').toString('base64'),
    createdBy: 'Someone',
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await mongoose.connection.collection('messages').insertOne({
    room,
    username: 'Someone',
    text: 'e2e.v1.aXZpdml2aXY.Y2lwaGVydGV4dA',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const response = await api(`/api/admin/private-rooms/${room}`, { token });
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.readable, false);
  assert.ok(body.messages[0].text.startsWith('e2e.v1.'));
});

test('the room list reports how much each room holds', async () => {
  const listed = await api('/api/admin/private-rooms', { token }).then((r) => r.json());
  const entry = listed.rooms.find((room) => room.room === 'p-test-room-abcdef123456');
  assert.equal(entry.messages, 1);
  assert.equal(entry.hasKey, true);
});
