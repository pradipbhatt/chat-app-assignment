import { Server } from 'socket.io';
import { config } from '../config/env.js';
import { registerHandlers } from './handlers.js';
import { registerAdminHandlers } from './adminHandlers.js';
import { verifyToken } from '../utils/token.js';
import { ROLES } from '../models/User.js';
import { setIo } from './ioRef.js';

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrls, methods: ['GET', 'POST'] },
    maxHttpBufferSize: config.maxPayloadBytes,
  });

  io.use((socket, next) => {
    const account = verifyToken(socket.handshake.auth?.token);
    socket.data.account = account;
    socket.data.role = account?.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected ${socket.id} as ${socket.data.role}`);
    registerHandlers(io, socket);
    registerAdminHandlers(io, socket);
    socket.on('disconnect', (reason) =>
      console.log(`[socket] disconnected ${socket.id} (${reason})`),
    );
  });

  setIo(io);
  return io;
}
