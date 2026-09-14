import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { getStats } from './socket/rooms.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  // Useful during the demo, and required by most Node hosts' health checks.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), ...getStats() });
  });

  return app;
}
