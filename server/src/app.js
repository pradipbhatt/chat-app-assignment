import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import logRoutes from './routes/logs.js';
import escrowRoutes from './routes/escrow.js';
import themeRoutes from './routes/themes.js';
import roomRoutes from './routes/rooms.js';
import messageRoutes from './routes/messages.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use('/health', cors({ origin: '*', methods: ['GET'] }));
  app.use(cors({ origin: config.clientUrls }));
  app.use(express.json({ limit: config.maxPayloadBytes }));

  app.use('/', healthRoutes);
  app.use('/api', authRoutes);
  app.use('/api', logRoutes);
  app.use('/api', escrowRoutes);
  app.use('/api', adminRoutes);
  app.use('/api', themeRoutes);
  app.use('/api', roomRoutes);
  app.use('/api', messageRoutes);

  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' }));

  return app;
}
