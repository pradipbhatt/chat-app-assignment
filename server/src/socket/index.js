import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { registerHandlers } from './handlers.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    // CORS must be configured here as well as on the Express app. The Socket.IO
    // handshake is a separate request from the REST routes, so allowing the
    // origin on Express alone leaves the handshake blocked — which presents as
    // a client that never connects while /health works fine.
    cors: { origin: config.clientUrl, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);
    registerHandlers(io, socket);
    socket.on('disconnect', (reason) => console.log(`[socket] disconnected ${socket.id} (${reason})`));
  });

  return io;
}
