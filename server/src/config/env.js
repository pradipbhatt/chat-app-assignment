import 'dotenv/config';

const parseOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const origins = parseOrigins(process.env.CLIENT_URL);

export const config = {
  port: Number(process.env.PORT) || 5050,
  clientUrls: origins.length ? origins : ['http://localhost:5173'],
  mongoUri: process.env.MONGODB_URI || '',
  historyLimit: Number(process.env.HISTORY_LIMIT) || 50,
  maxPayloadBytes: Number(process.env.MAX_PAYLOAD_BYTES) || 16384,
  rateLimit: {
    capacity: Number(process.env.RATE_LIMIT_CAPACITY) || 5,
    refillPerSecond: Number.isFinite(Number(process.env.RATE_LIMIT_REFILL_PER_SECOND))
      ? Number(process.env.RATE_LIMIT_REFILL_PER_SECOND)
      : 5,
  },
  shutdownTimeoutMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 5000,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  admin: {
    username: (process.env.ADMIN_USERNAME || '').trim(),
    password: process.env.ADMIN_PASSWORD || '',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function logConfig() {
  console.log('[config]', {
    port: config.port,
    clientUrls: config.clientUrls,
    historyLimit: config.historyLimit,
    nodeEnv: config.nodeEnv,
    mongo: config.mongoUri ? 'configured' : 'missing',
    auth: config.jwtSecret ? 'configured' : 'missing',
  });
}
