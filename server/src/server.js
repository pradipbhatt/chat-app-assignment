import { createServer } from 'node:http';
import { config, logConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';

async function start() {
  await connectDatabase();

  const httpServer = createServer(createApp());
  createSocketServer(httpServer);

  httpServer.listen(config.port, () => {
    logConfig();
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`\n[server] ${signal} received, shutting down`);
      httpServer.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    });
  }
}

start().catch((error) => {
  console.error('[server] failed to start:', error.message);
  process.exit(1);
});
