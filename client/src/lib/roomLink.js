import { normaliseRoom, validateRoom } from './validation.js';

const ADJECTIVES = [
  'amber', 'brave', 'calm', 'clever', 'coral', 'crisp', 'eager', 'fern',
  'gentle', 'hazel', 'ivory', 'jolly', 'keen', 'lucid', 'mellow', 'noble',
  'olive', 'plum', 'quick', 'rapid', 'sage', 'teal', 'umber', 'vivid',
];

const NOUNS = [
  'otter', 'falcon', 'maple', 'harbour', 'lantern', 'meadow', 'comet', 'willow',
  'canyon', 'ember', 'pebble', 'anchor', 'quartz', 'thistle', 'beacon', 'juniper',
  'marten', 'cascade', 'orchard', 'summit',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function suggestRoomName() {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${Math.floor(Math.random() * 90) + 10}`;
}

export function readRoomFromUrl() {
  if (typeof window === 'undefined') return '';

  const fromPath = window.location.pathname.match(/^\/r\/([^/]+)\/?$/);
  const candidate = fromPath
    ? decodeURIComponent(fromPath[1])
    : new URLSearchParams(window.location.search).get('room') || '';

  const room = normaliseRoom(candidate);
  return validateRoom(room) === null ? room : '';
}

export function roomUrl(room) {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/r/${encodeURIComponent(normaliseRoom(room))}`;
}

export function showRoomInUrl(room) {
  if (typeof window === 'undefined') return;
  const next = `/r/${encodeURIComponent(normaliseRoom(room))}`;
  if (window.location.pathname !== next) {
    window.history.replaceState({}, '', next);
  }
}

export function clearRoomFromUrl() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
}

export async function copyRoomLink(room) {
  const url = roomUrl(room);
  try {
    await navigator.clipboard.writeText(url);
    return { ok: true, url };
  } catch (error) {
    return { ok: false, url };
  }
}
