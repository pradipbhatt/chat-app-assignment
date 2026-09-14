import { Router } from 'express';
import mongoose from 'mongoose';
import { attachUser, requireAdmin } from '../middleware/auth.js';
import { listEntries } from '../utils/logBuffer.js';
import { getStats } from '../socket/rooms.js';
import { listPrivateRooms } from '../socket/privateRooms.js';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export function serverStatus() {
  const memory = process.memoryUsage();
  return {
    uptime: Math.round(process.uptime()),
    database: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    memoryMb: Math.round((memory.rss / 1024 / 1024) * 10) / 10,
    heapMb: Math.round((memory.heapUsed / 1024 / 1024) * 10) / 10,
    node: process.version,
    privateRooms: listPrivateRooms().length,
    ...getStats(),
  };
}

router.use('/admin/logs', attachUser, requireAdmin);

router.get('/admin/logs', (req, res) => {
  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 400) : 200;
  res.json({ ok: true, status: serverStatus(), entries: listEntries(limit) });
});

export default router;
