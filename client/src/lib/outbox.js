export const OUTBOX_LIMITS = {
  capacity: 5,
  refillPerSecond: 5,
  maxAttempts: 14,
  refusalBackoffMs: 240,
  offlinePollMs: 400,
};

export function createTokenBucket({ capacity, refillPerSecond } = OUTBOX_LIMITS) {
  let tokens = capacity;
  let last = Date.now();

  return {
    waitMs() {
      const now = Date.now();
      tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSecond);
      last = now;
      if (tokens >= 1) return 0;
      return Math.ceil(((1 - tokens) / refillPerSecond) * 1000);
    },
    take() {
      tokens -= 1;
    },
    drain() {
      tokens = 0;
      last = Date.now();
    },
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
