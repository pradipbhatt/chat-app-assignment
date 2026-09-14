import { Router } from 'express';
import mongoose from 'mongoose';
import { getStats } from '../socket/rooms.js';
import { config } from '../config/env.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    auth: config.jwtSecret ? 'configured' : 'missing',
    ...getStats(),
  });
});

export default router;
