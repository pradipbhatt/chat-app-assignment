import { Router } from 'express';
import mongoose from 'mongoose';
import { getStats } from '../socket/rooms.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    ...getStats(),
  });
});

export default router;
