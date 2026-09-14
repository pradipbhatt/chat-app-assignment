import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import 'dotenv/config';

const PORT = Number(process.env.TEST_THEME_PORT) || 5153;
const BASE = `http://localhost:${PORT}`;
const TEST_DB = 'chatapp_theme_test';
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

const ADMIN_USERNAME = 'themeadmin';
const ADMIN_PASSWORD = randomBytes(12).toString('base64url');

const TOKENS = [
  'bg',
  'surface',
  'elevated',
  'fg',
  'fg-muted',
  'fg-subtle',
  'border',
  'accent',
  'accent-fg',
  'accent-hover',
  'success',
  'warning',
  'danger',
  'track',
];

const colours = (overrides = {}) => {
  const base = {};
  for (const token of TOKENS) base[token] = '120 120 120';
  return { ...base, ...overrides };
};

const testUri = () => {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error('MONGODB_URI is required to run the theme tests.');
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

test('anyone can read the theme list', async () => {
  const response = await api('/api/themes');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.themes));
});

test('only an administrator can save a theme', async () => {
  const anonymous = await api('/api/themes', {
    method: 'POST',
    body: { name: 'Nope', mode: 'light', colors: colours(), shadowTint: '0 0 0' },
  });
  assert.equal(anonymous.status, 401);

  const forged = await api('/api/themes', {
    method: 'POST',
    token: 'forged.token.value',
    body: { name: 'Nope', mode: 'light', colors: colours(), shadowTint: '0 0 0' },
  });
  assert.equal(forged.status, 401);
});

test('a colour value that is not three channels is refused', async () => {
  const injected = await api('/api/themes', {
    method: 'POST',
    token,
    body: {
      name: 'Injection',
      mode: 'light',
      colors: colours({ bg: 'red; background:url(javascript:alert(1))' }),
      shadowTint: '0 0 0',
    },
  });
  assert.equal(injected.status, 400);
  assert.equal((await injected.json()).code, 'THEME_COLOR_INVALID');

  const outOfRange = await api('/api/themes', {
    method: 'POST',
    token,
    body: { name: 'Too big', mode: 'light', colors: colours({ fg: '300 0 0' }), shadowTint: '0 0 0' },
  });
  assert.equal(outOfRange.status, 400);
});

test('a missing token is refused rather than defaulted', async () => {
  const partial = colours();
  delete partial.accent;

  const response = await api('/api/themes', {
    method: 'POST',
    token,
    body: { name: 'Partial', mode: 'light', colors: partial, shadowTint: '0 0 0' },
  });
  assert.equal(response.status, 400);
});

test('an invalid mode is refused', async () => {
  const response = await api('/api/themes', {
    method: 'POST',
    token,
    body: { name: 'Odd mode', mode: 'neon', colors: colours(), shadowTint: '0 0 0' },
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'THEME_MODE_INVALID');
});

test('an administrator can create, read back, update and delete a theme', async () => {
  const created = await api('/api/themes', {
    method: 'POST',
    token,
    body: {
      name: 'Citrus Clay',
      mode: 'light',
      colors: colours({ bg: '255 247 234', accent: '212 91 18' }),
      shadowTint: '120 60 10',
    },
  }).then((response) => response.json());

  assert.equal(created.ok, true);
  assert.equal(created.theme.slug, 'citrus-clay');
  assert.equal(created.theme.colors.accent, '212 91 18');
  assert.equal(created.theme.createdBy, ADMIN_USERNAME);

  const listed = await api('/api/themes').then((response) => response.json());
  assert.ok(listed.themes.some((entry) => entry.slug === 'citrus-clay'));

  const updated = await api(`/api/themes/${created.theme.id}`, {
    method: 'PUT',
    token,
    body: {
      name: 'Citrus Clay Dark',
      mode: 'dark',
      colors: colours({ bg: '20 14 8' }),
      shadowTint: '0 0 0',
    },
  }).then((response) => response.json());

  assert.equal(updated.theme.mode, 'dark');
  assert.equal(updated.theme.colors.bg, '20 14 8');

  const removed = await api(`/api/themes/${created.theme.id}`, { method: 'DELETE', token });
  assert.equal(removed.status, 200);

  const after = await api('/api/themes').then((response) => response.json());
  assert.ok(!after.themes.some((entry) => entry.id === created.theme.id));
});

test('two themes with the same name get distinct slugs', async () => {
  const body = {
    name: 'Twin',
    mode: 'light',
    colors: colours(),
    shadowTint: '0 0 0',
  };

  const first = await api('/api/themes', { method: 'POST', token, body }).then((r) => r.json());
  const second = await api('/api/themes', { method: 'POST', token, body }).then((r) => r.json());

  assert.notEqual(first.theme.slug, second.theme.slug);
});
