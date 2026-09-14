import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { registerHandlers } from './handlers.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id}`);
    registerHandlers(io, socket);
    socket.on('disconnect', (reason) =>
      console.log(`[socket] disconnected ${socket.id} (${reason})`),
    );
  });

  return io;
}
