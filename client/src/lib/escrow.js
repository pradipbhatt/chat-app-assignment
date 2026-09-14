const PBKDF2_ROUNDS = 250000;

const encoder = new TextEncoder();

function toBase64(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function passphraseKey(passphrase, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createEscrowKeypair(passphrase) {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrappingKey = await passphraseKey(passphrase, salt, PBKDF2_ROUNDS);

  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, privatePkcs8);

  return {
    publicKeyJwk,
    wrappedPrivateKey: toBase64(wrapped),
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: PBKDF2_ROUNDS,
  };
}

export async function unlockEscrowKey(vault, passphrase) {
  try {
    const salt = fromBase64(vault.salt);
    const iv = fromBase64(vault.iv);
    const wrappingKey = await passphraseKey(passphrase, salt, vault.iterations);

    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      wrappingKey,
      fromBase64(vault.wrappedPrivateKey),
    );

    return crypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, [
      'decrypt',
    ]);
  } catch (error) {
    return null;
  }
}

export async function wrapRoomKey(publicKeyJwk, rawSecret) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  );

  const raw = fromBase64(rawSecret.replace(/-/g, '+').replace(/_/g, '/'));
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw);
  return toBase64(wrapped);
}

export async function unwrapRoomKey(privateKey, wrappedKey) {
  try {
    const raw = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      fromBase64(wrappedKey),
    );
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  } catch (error) {
    return null;
  }
}
