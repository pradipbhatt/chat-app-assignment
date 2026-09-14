import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redact, record, listEntries, subscribe, resetLogBuffer } from '../src/utils/logBuffer.js';

beforeEach(() => resetLogBuffer());

test('a mongo connection string never reaches the buffer with its password', () => {
  record('error', ['connect failed mongodb+srv://appuser:sup3rsecret@cluster0.mongodb.net/chatapp']);
  const [entry] = listEntries();
  assert.ok(!entry.message.includes('sup3rsecret'));
  assert.ok(entry.message.includes('***:***@'));
});

test('bearer tokens and jwts are masked', () => {
  assert.ok(!redact('Authorization: Bearer abc.def.ghi').includes('abc.def.ghi'));
  assert.ok(!redact('token eyJhbGciOiJIUzI1NiJ9.payloadpart.signature').includes('payloadpart'));
});

test('keys that look like secrets are masked whatever the shape', () => {
  assert.ok(!redact('{"password":"hunter2"}').includes('hunter2'));
  assert.ok(!redact('JWT_SECRET=9f8e7d6c5b4a').includes('9f8e7d6c5b4a'));
});

test('ordinary lines are left readable', () => {
  const line = '[socket] connected abc123 as admin';
  assert.equal(redact(line), line);
});

test('the buffer keeps only the most recent entries', () => {
  for (let i = 0; i < 450; i += 1) record('info', [`line ${i}`]);
  const entries = listEntries();
  assert.equal(entries.length, 400);
  assert.equal(entries.at(-1).message, 'line 449');
});

test('a very long line is truncated rather than streamed whole', () => {
  record('info', ['x'.repeat(5000)]);
  assert.ok(listEntries()[0].message.length <= 1200);
});

test('subscribers receive new entries and can detach', () => {
  const seen = [];
  const stop = subscribe((entry) => seen.push(entry.message));

  record('info', ['first']);
  stop();
  record('info', ['second']);

  assert.deepEqual(seen, ['first']);
});

test('a throwing subscriber does not stop the server logging', () => {
  subscribe(() => {
    throw new Error('listener blew up');
  });

  assert.doesNotThrow(() => record('info', ['still fine']));
  assert.equal(listEntries().at(-1).message, 'still fine');
});
