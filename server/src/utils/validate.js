export const LIMITS = {
  username: { min: 1, max: 24 },
  room: { min: 1, max: 32 },
  text: { min: 1, max: 2000 },
  encrypted: { min: 1, max: 6000 },
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
  if (!/^[a-z0-9-]+$/.test(value))
    return fail('ROOM_CHARSET', 'Room name may contain only letters, numbers and hyphens.');
  return { ok: true, value };
}

export function validateText(input, max = LIMITS.text.max) {
  if (typeof input !== 'string') return fail('MESSAGE_INVALID', 'Message is required.');
  const value = input.trim();
  if (value.length < LIMITS.text.min) return fail('MESSAGE_EMPTY', 'Message is empty.');
  if (value.length > max)
    return fail('MESSAGE_TOO_LONG', `Message must be ${max} characters or fewer.`);
  return { ok: true, value };
}

export const THEME_TOKENS = [
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

const CHANNEL = /^([01]?\d{1,2}|2[0-4]\d|25[0-5])$/;

function isChannelTriple(value) {
  if (typeof value !== 'string') return false;
  const parts = value.trim().split(/\s+/);
  return parts.length === 3 && parts.every((part) => CHANNEL.test(part));
}

export function validateThemeName(input) {
  if (typeof input !== 'string') return fail('THEME_NAME_INVALID', 'Theme name is required.');
  const value = input.trim().replace(/\s+/g, ' ');
  if (value.length < 2) return fail('THEME_NAME_INVALID', 'Theme name is required.');
  if (value.length > 32)
    return fail('THEME_NAME_TOO_LONG', 'Theme name must be 32 characters or fewer.');
  if (!/^[\w \-']+$/.test(value))
    return fail('THEME_NAME_CHARSET', 'Use letters, numbers, spaces and hyphens only.');
  return { ok: true, value };
}

export function validateTheme(payload = {}) {
  const name = validateThemeName(payload.name);
  if (!name.ok) return name;

  const mode = payload.mode === 'dark' ? 'dark' : payload.mode === 'light' ? 'light' : null;
  if (!mode) return fail('THEME_MODE_INVALID', 'Choose whether the theme is light or dark.');

  const source = payload.colors;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return fail('THEME_COLORS_INVALID', 'Theme colours are missing.');
  }

  const colors = {};
  for (const token of THEME_TOKENS) {
    const value = source[token];
    if (!isChannelTriple(value)) {
      return fail('THEME_COLOR_INVALID', `The ${token} colour is not a valid value.`);
    }
    colors[token] = value.trim().split(/\s+/).join(' ');
  }

  if (!isChannelTriple(payload.shadowTint)) {
    return fail('THEME_SHADOW_INVALID', 'The shadow tint is not a valid value.');
  }

  return {
    ok: true,
    value: {
      name: name.value,
      mode,
      colors,
      shadowTint: payload.shadowTint.trim().split(/\s+/).join(' '),
    },
  };
}
