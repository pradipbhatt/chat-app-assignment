import { config } from '../config/env.js';

const IDLE_TTL_MS = 5 * 60 * 1000;

const buckets = new Map();

const keyFor = (room, username) => `${room}:${username.toLowerCase()}`;

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (now - bucket.last > IDLE_TTL_MS) buckets.delete(key);
  }
}

export function consumeToken(room, username) {
  const now = Date.now();
  const key = keyFor(room, username);

  let bucket = buckets.get(key);
  if (!bucket) {
    prune(now);
    bucket = { tokens: config.rateLimit.capacity, last: now };
    buckets.set(key, bucket);
  }

  bucket.tokens = Math.min(
    config.rateLimit.capacity,
    bucket.tokens + ((now - bucket.last) / 1000) * config.rateLimit.refillPerSecond,
  );
  bucket.last = now;

  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}
