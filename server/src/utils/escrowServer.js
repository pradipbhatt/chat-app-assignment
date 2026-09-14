import {
  generateKeyPairSync,
  createPrivateKey,
  privateDecrypt,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  constants,
} from 'node:crypto';
import { config } from '../config/env.js';
import { Escrow, readEscrow } from '../models/Escrow.js';

const ENVELOPE_PREFIX = 'e2e.v1.';

const fromBase64Url = (value) =>
  Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function sealingKey(salt) {
  const secret = config.escrowSecret;
  if (!secret) throw new Error('ESCROW_SECRET or JWT_SECRET must be set to seal the review key.');
  return scryptSync(secret, salt, 32);
}

function seal(privatePem) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealingKey(salt), iv);
  const sealed = Buffer.concat([cipher.update(privatePem, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    wrappedPrivateKey: Buffer.concat([sealed, tag]).toString('base64'),
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
  };
}

function unseal(record) {
  const raw = Buffer.from(record.wrappedPrivateKey, 'base64');
  const tag = raw.subarray(raw.length - 16);
  const body = raw.subarray(0, raw.length - 16);

  const decipher = createDecipheriv(
    'aes-256-gcm',
    sealingKey(Buffer.from(record.salt, 'base64')),
    Buffer.from(record.iv, 'base64'),
  );
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
}

function canOpen(record) {
  try {
    createPrivateKey(unseal(record));
    return true;
  } catch (error) {
    return false;
  }
}

export async function ensureServerEscrow() {
  if (!config.escrowSecret) {
    console.warn('[escrow] no sealing secret configured, review key not created');
    return null;
  }

  const existing = await readEscrow();

  if (existing && existing.sealedBy === 'server') {
    if (canOpen(existing)) return existing;
    console.warn(
      '[escrow] the stored review key cannot be opened with this ESCROW_SECRET, replacing it — rooms created under the previous key are no longer reviewable',
    );
  }

  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const sealed = seal(privatePem);

  const payload = {
    label: 'admin',
    publicKeyJwk: { ...publicJwk, alg: 'RSA-OAEP-256', ext: true, key_ops: ['encrypt'] },
    ...sealed,
    iterations: 1,
    sealedBy: 'server',
    createdBy: 'server',
  };

  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    console.log('[escrow] review key replaced with a server sealed key');
    return existing;
  }

  const created = await Escrow.create(payload);
  console.log('[escrow] server sealed review key created');
  return created;
}

let cachedPrivate = null;

async function privateKeyObject() {
  if (cachedPrivate) return cachedPrivate;

  const record = await readEscrow();
  if (!record || record.sealedBy !== 'server') return null;

  try {
    cachedPrivate = createPrivateKey(unseal(record));
  } catch (error) {
    console.warn('[escrow] the stored review key could not be opened');
    return null;
  }

  return cachedPrivate;
}

export async function unwrapRoomKey(wrappedKey) {
  const key = await privateKeyObject();
  if (!key || !wrappedKey) return null;

  try {
    return privateDecrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(wrappedKey, 'base64'),
    );
  } catch (error) {
    return null;
  }
}

export function decryptEnvelope(roomKey, text) {
  if (!roomKey || typeof text !== 'string' || !text.startsWith(ENVELOPE_PREFIX)) return null;

  const [ivPart, cipherPart] = text.slice(ENVELOPE_PREFIX.length).split('.');
  if (!ivPart || !cipherPart) return null;

  try {
    const payload = fromBase64Url(cipherPart);
    const tag = payload.subarray(payload.length - 16);
    const body = payload.subarray(0, payload.length - 16);

    const decipher = createDecipheriv('aes-256-gcm', roomKey, fromBase64Url(ivPart));
    decipher.setAuthTag(tag);

    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch (error) {
    return null;
  }
}

export function forgetCachedKey() {
  cachedPrivate = null;
}
