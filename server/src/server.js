import { createServer } from 'node:http';
import { config, logConfig } from './config/env.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/index.js';

// Express and Socket.IO share one HTTP server: the WebSocket upgrade arrives on
// the same port as the REST routes, so there is a single port to configure and
// a single origin for the client to know about.
const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  logConfig();
  console.log(`[server] listening on http://localhost:${config.port}`);
});

// Without these, a container stop waits for the OS to kill the process and open
// sockets are severed rather than closed.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[server] ${signal} received, shutting down`);
    httpServer.close(() => process.exit(0));
  });
}
