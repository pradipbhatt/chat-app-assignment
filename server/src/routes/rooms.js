import { Router } from 'express';
import { getActiveRooms } from '../socket/rooms.js';
import { isPrivateName } from '../socket/privateRooms.js';
import { getRoomsWithHistory } from '../models/Message.js';

const router = Router();

router.get('/rooms', async (_req, res) => {
  const active = getActiveRooms().filter((entry) => !isPrivateName(entry.room));
  const activeNames = new Set(active.map((entry) => entry.room));

  let stored = [];
  try {
    stored = await getRoomsWithHistory();
  } catch (error) {
    console.error('[api] failed to list rooms with history', error);
  }

  const byName = new Map(
    stored
      .filter((entry) => !isPrivateName(entry._id))
      .map((entry) => [
        entry._id,
        { messages: entry.messages, lastMessageAt: entry.lastMessageAt?.getTime() ?? null },
      ]),
  );

  const live = active.map((entry) => ({
    room: entry.room,
    users: entry.users,
    messages: byName.get(entry.room)?.messages ?? 0,
    lastMessageAt: byName.get(entry.room)?.lastMessageAt ?? null,
  }));

  const quiet = [...byName.entries()]
    .filter(([room]) => !activeNames.has(room))
    .map(([room, meta]) => ({ room, users: 0, ...meta }));

  res.json({ rooms: [...live, ...quiet] });
});

export default router;
