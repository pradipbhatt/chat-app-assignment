import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import healthRoutes from './routes/health.js';
import messageRoutes from './routes/messages.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  app.use('/', healthRoutes);
  app.use('/api', messageRoutes);

  app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found.' }));

  return app;
}
