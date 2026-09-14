import 'dotenv/config';

/**
 * Single source of truth for configuration. Nothing else in the server reads
 * process.env directly, so there is exactly one place to look when a value is
 * wrong and one place to change when a value moves.
 */
export const config = {
  port: Number(process.env.PORT) || 5050,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export function logConfig() {
  console.log('[config]', {
    port: config.port,
    clientUrl: config.clientUrl,
    nodeEnv: config.nodeEnv,
  });
}
