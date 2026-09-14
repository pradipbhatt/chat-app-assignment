import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import 'dotenv/config';

const PORT = Number(process.env.TEST_ESCROW_PORT) || 5154;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = 'chatapp_escrow_test';
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

const ADMIN_USERNAME = 'escrowadmin';
const ADMIN_PASSWORD = randomBytes(12).toString('base64url');

const PUBLIC_JWK = { kty: 'RSA', n: 'x'.repeat(340), e: 'AQAB', alg: 'RSA-OAEP-256', ext: true };

const testUri = () => {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error('MONGODB_URI is required to run the escrow tests.');
  const [scheme, remainder] = raw.split('://');
  const [hostAndPath, query = ''] = remainder.split('?');
  const host = hostAndPath.split('/')[0];
  return `${scheme}://${host}/${TEST_DB}${query ? `?${query}` : ''}`;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const validVault = () => ({
  publicKeyJwk: PUBLIC_JWK,
  wrappedPrivateKey: Buffer.from('sealed-private-key').toString('base64'),
  salt: Buffer.from('saltsaltsaltsalt').toString('base64'),
  iv: Buffer.from('ivivivivivii').toString('base64'),
  iterations: 250000,
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

test('the public key is readable by anyone, and absent before setup', async () => {
  const response = await api('/api/escrow/public-key');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).escrow, null);
});

test('the sealed private key is never served to a non administrator', async () => {
  assert.equal((await api('/api/escrow/vault')).status, 401);
  assert.equal((await api('/api/escrow/vault', { token: 'forged.token.value' })).status, 401);
});

test('a malformed vault is refused', async () => {
  const badKey = await api('/api/escrow/vault', {
    method: 'POST',
    token,
    body: { ...validVault(), publicKeyJwk: { kty: 'oct' } },
  });
  assert.equal(badKey.status, 400);

  const weak = await api('/api/escrow/vault', {
    method: 'POST',
    token,
    body: { ...validVault(), iterations: 1000 },
  });
  assert.equal(weak.status, 400);
  assert.equal((await weak.json()).code, 'ESCROW_ROUNDS_INVALID');

  const junk = await api('/api/escrow/vault', {
    method: 'POST',
    token,
    body: { ...validVault(), salt: 'not base64!!' },
  });
  assert.equal(junk.status, 400);
});

test('an administrator can store and read back the sealed key', async () => {
  const saved = await api('/api/escrow/vault', { method: 'POST', token, body: validVault() });
  assert.equal(saved.status, 201);

  const shared = await api('/api/escrow/public-key').then((response) => response.json());
  assert.equal(shared.escrow.publicKeyJwk.kty, 'RSA');
  assert.equal(shared.escrow.publicKeyJwk.n, PUBLIC_JWK.n);

  const vault = await api('/api/escrow/vault', { token }).then((response) => response.json());
  assert.equal(vault.vault.iterations, 250000);
  assert.equal(vault.vault.wrappedPrivateKey, validVault().wrappedPrivateKey);
});

test('the public endpoint never exposes the sealed private key', async () => {
  const body = await api('/api/escrow/public-key').then((response) => response.json());
  const serialised = JSON.stringify(body);
  assert.ok(!serialised.includes(validVault().wrappedPrivateKey));
  assert.ok(!serialised.includes(validVault().salt));
});

test('private room review is closed to anyone without an administrator token', async () => {
  assert.equal((await api('/api/admin/private-rooms')).status, 401);
  assert.equal((await api('/api/admin/private-rooms/p-room-abc')).status, 401);
});

test('a stored room returns ciphertext and its wrapped key, never plaintext', async () => {
  await mongoose.connection.collection('roomkeys').insertOne({
    room: 'p-test-room-abcdef123456',
    wrappedKey: 'd3JhcHBlZC1rZXk=',
    createdBy: 'Someone',
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await mongoose.connection.collection('messages').insertOne({
    room: 'p-test-room-abcdef123456',
    username: 'Someone',
    text: 'e2e.v1.aXZpdml2aXY.Y2lwaGVydGV4dA',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const body = await api('/api/admin/private-rooms/p-test-room-abcdef123456', { token }).then((r) =>
    r.json(),
  );

  assert.equal(body.wrappedKey, 'd3JhcHBlZC1rZXk=');
  assert.equal(body.messages.length, 1);
  assert.ok(body.messages[0].text.startsWith('e2e.v1.'));

  const listed = await api('/api/admin/private-rooms', { token }).then((r) => r.json());
  const entry = listed.rooms.find((room) => room.room === 'p-test-room-abcdef123456');
  assert.equal(entry.messages, 1);
  assert.equal(entry.hasKey, true);
});
