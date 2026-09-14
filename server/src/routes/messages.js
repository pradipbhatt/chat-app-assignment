import { Router } from 'express';
import { getRecentMessages } from '../models/Message.js';
import { validateRoom } from '../utils/validate.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/rooms/:room/messages', async (req, res) => {
  const room = validateRoom(req.params.room);
  if (!room.ok) return res.status(400).json({ code: room.code, message: room.message });

  const requested = Number(req.query.limit);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), 200)
    : config.historyLimit;

  try {
    const page = await getRecentMessages(room.value, limit, req.query.before ?? null);
    if (page.invalidCursor) {
      return res
        .status(400)
        .json({ code: 'CURSOR_INVALID', message: 'The before cursor is not a valid timestamp.' });
    }
    return res.json({
      room: room.value,
      count: page.messages.length,
      hasMore: page.hasMore,
      messages: page.messages,
    });
  } catch (error) {
    console.error('[api] failed to load messages', error);
    return res.status(500).json({ code: 'HISTORY_FAILED', message: 'Could not load messages.' });
  }
});

export default router;
