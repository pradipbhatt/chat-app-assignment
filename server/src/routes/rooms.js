import { Router } from 'express';
import { getActiveRooms } from '../socket/rooms.js';
import { getRoomsWithHistory } from '../models/Message.js';

const router = Router();

router.get('/rooms', async (_req, res) => {
  const active = getActiveRooms();
  const activeNames = new Set(active.map((entry) => entry.room));

  let archived = [];
  try {
    const stored = await getRoomsWithHistory();
    archived = stored
      .filter((room) => !activeNames.has(room))
      .map((room) => ({ room, users: 0 }))
      .sort((a, b) => a.room.localeCompare(b.room));
  } catch (error) {
    console.error('[api] failed to list rooms with history', error);
  }

  res.json({ rooms: [...active, ...archived] });
});

export default router;
