export const LIMITS = {
  username: { min: 1, max: 24 },
  room: { min: 1, max: 32 },
};

export const ROOM_PATTERN = /^[a-z0-9-]+$/;

export function normaliseRoom(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function validateUsername(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length < LIMITS.username.min) return 'Enter a display name.';
  if (trimmed.length > LIMITS.username.max)
    return `Keep it to ${LIMITS.username.max} characters or fewer.`;
  return null;
}

export function validateRoom(value) {
  const room = normaliseRoom(value);
  if (room.length < LIMITS.room.min) return 'Choose or enter a room.';
  if (room.length > LIMITS.room.max)
    return `Room names are ${LIMITS.room.max} characters or fewer.`;
  if (!ROOM_PATTERN.test(room)) return 'Use lowercase letters, numbers and hyphens only.';
  return null;
}
