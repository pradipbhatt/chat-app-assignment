import { createServer } from 'node:http';
import { config, logConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';
import { seedAdmin, loadReservedUsernames } from './models/User.js';

async function start() {
  await connectDatabase();
  await seedAdmin();
  await loadReservedUsernames();

  const httpServer = createServer(createApp());
  const io = createSocketServer(httpServer);

  httpServer.listen(config.port, () => {
    logConfig();
    console.log(`[server] listening on http://localhost:${config.port}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[server] ${signal} received, shutting down`);

    const force = setTimeout(() => {
      console.warn('[server] forced exit after shutdown timeout');
      process.exit(1);
    }, config.shutdownTimeoutMs);
    force.unref();

    io.disconnectSockets(true);
    io.close(() => {
      httpServer.close(async () => {
        await disconnectDatabase();
        clearTimeout(force);
        process.exit(0);
      });
    });
  };

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => shutdown(signal));
  }
}

start().catch((error) => {
  console.error('[server] failed to start:', error.message);
  process.exit(1);
});
