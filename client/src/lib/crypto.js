export const ENVELOPE_PREFIX = 'e2e.v1.';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function generateRoomKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await crypto.subtle.exportKey('raw', key);
  return { key, secret: toBase64Url(raw) };
}

export async function importRoomKey(secret) {
  try {
    const bytes = fromBase64Url(secret);
    if (bytes.byteLength !== 32) return null;
    return await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt',
    ]);
  } catch (error) {
    return null;
  }
}

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text),
  );
  return `${ENVELOPE_PREFIX}${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export function isEnvelope(value) {
  return typeof value === 'string' && value.startsWith(ENVELOPE_PREFIX);
}

export async function decryptText(key, envelope) {
  if (!isEnvelope(envelope)) return null;

  const [ivPart, cipherPart] = envelope.slice(ENVELOPE_PREFIX.length).split('.');
  if (!ivPart || !cipherPart) return null;

  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(cipherPart),
    );
    return decoder.decode(plain);
  } catch (error) {
    return null;
  }
}
