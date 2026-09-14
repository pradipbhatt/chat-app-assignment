import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 5050,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
  historyLimit: Number(process.env.HISTORY_LIMIT) || 50,
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function logConfig() {
  console.log('[config]', {
    port: config.port,
    clientUrl: config.clientUrl,
    historyLimit: config.historyLimit,
    nodeEnv: config.nodeEnv,
    mongo: config.mongoUri ? 'configured' : 'missing',
  });
}
