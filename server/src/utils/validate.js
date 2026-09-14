/**
 * Validation for everything that arrives from a client.
 *
 * Every function returns { ok, value } or { ok: false, code, message } instead
 * of throwing. An uncaught throw inside a Socket.IO handler takes down the
 * process, which would disconnect every other user in every room because one
 * client sent a malformed payload.
 */

export const LIMITS = {
  username: { min: 1, max: 24 },
  room: { min: 1, max: 32 },
  text: { min: 1, max: 2000 },
};

const fail = (code, message) => ({ ok: false, code, message });

export function validateUsername(input) {
  if (typeof input !== 'string') return fail('USERNAME_INVALID', 'Username is required.');
  const value = input.trim();
  if (value.length < LIMITS.username.min) return fail('USERNAME_INVALID', 'Username is required.');
  if (value.length > LIMITS.username.max)
    return fail('USERNAME_TOO_LONG', `Username must be ${LIMITS.username.max} characters or fewer.`);
  return { ok: true, value };
}

export function validateRoom(input) {
  if (typeof input !== 'string') return fail('ROOM_INVALID', 'Room is required.');
  const value = input.trim().toLowerCase();
  if (value.length < LIMITS.room.min) return fail('ROOM_INVALID', 'Room is required.');
  if (value.length > LIMITS.room.max)
    return fail('ROOM_TOO_LONG', `Room name must be ${LIMITS.room.max} characters or fewer.`);
  // Restricted charset: room names are used as Socket.IO room keys and shown in
  // the UI, so keep them boringly predictable rather than accepting anything.
  if (!/^[a-z0-9-]+$/.test(value))
    return fail('ROOM_CHARSET', 'Room name may contain only letters, numbers and hyphens.');
  return { ok: true, value };
}

export function validateText(input) {
  if (typeof input !== 'string') return fail('MESSAGE_INVALID', 'Message is required.');
  const value = input.trim();
  if (value.length < LIMITS.text.min) return fail('MESSAGE_EMPTY', 'Message is empty.');
  if (value.length > LIMITS.text.max)
    return fail('MESSAGE_TOO_LONG', `Message must be ${LIMITS.text.max} characters or fewer.`);
  return { ok: true, value };
}
